import { notificationService, NotificationService } from "../../services/notification.services";
import { NotificationRepository } from "../../repositories/notification.repository";
import { pushService } from "../../services/push.services";
import { CreateNotificationRequestSchema, PaginatedNotificationQuerySchema, NotificationResponseSchema, PaginatedNotificationResponseSchema } from "../../schema/notification.schema";

jest.mock("../../repositories/notification.repository", () => ({
  NotificationRepository: {
    createAndSave: jest.fn(),
    findByFilters: jest.fn(),
    findByIdForUser: jest.fn(),
    updateReadStatus: jest.fn(),
    markManyRead: jest.fn(),
    countByFilters: jest.fn(),
  },
}));

jest.mock("../../services/push.services", () => ({
  pushService: {
    sendToUser: jest.fn(),
  },
}));

describe("NotificationService", () => {
  const repo = NotificationRepository as unknown as { [k: string]: jest.Mock };
  const pusher = pushService as unknown as { [k: string]: jest.Mock };
  const svc = new NotificationService(repo as any, pusher as any);

  beforeEach(() => jest.clearAllMocks());

  it("save persists and returns parsed response", async () => {
    const input = CreateNotificationRequestSchema.parse({ title: "hello", category: "SYSTEM", userId: 1 });
    const saved = { id: 1, title: "hello", category: "SYSTEM", userId: 1, read: false, createdAt: new Date(), updatedAt: new Date() };
    (repo.createAndSave as jest.Mock).mockResolvedValue(saved);
    const result = await svc.save(input);
    expect(repo.createAndSave).toHaveBeenCalledWith(input as any);
    expect(result).toEqual(NotificationResponseSchema.parse(saved));
  });

  it("sendAndSave persists, invokes push when sendToPush true, and returns parsed response", async () => {
    const input = CreateNotificationRequestSchema.parse({ title: "hey", category: "SYSTEM", userId: 2, sendToPush: true, delaySeconds: 5 });
    const saved = { id: 2, title: "hey", category: "SYSTEM", userId: 2, read: false, payload: { a: "b" }, body: "body", createdAt: new Date(), updatedAt: new Date() };
    (repo.createAndSave as jest.Mock).mockResolvedValue(saved);
    (pusher.sendToUser as jest.Mock).mockResolvedValue(undefined);

    const result = await svc.sendAndSave(input);

    expect(repo.createAndSave).toHaveBeenCalledWith(input as any);
    expect(pusher.sendToUser).toHaveBeenCalledWith(2, { title: "hey", body: "body" }, saved.payload, 5);
    expect(result).toEqual(NotificationResponseSchema.parse(saved));
  });

  it("list returns paginated response", async () => {
    const query = PaginatedNotificationQuerySchema.parse({ page: 1, pageSize: 10, order: "asc", sort: "createdAt" });
    const data = [ { id: 1, userId: 1, title: "t", category: "SYSTEM", read: false, createdAt: new Date(), updatedAt: new Date() } ];
    (repo.findByFilters as jest.Mock).mockResolvedValue({ data, total: 1 });
    const result = await svc.list(query);
    expect(repo.findByFilters).toHaveBeenCalledWith(query);
    expect(result).toEqual(PaginatedNotificationResponseSchema.parse({ data, page: 1, pageSize: 10, total: 1 }));
  });

  it("markRead updates record only if owned", async () => {
    (repo.findByIdForUser as jest.Mock).mockResolvedValue(null);
    await svc.markRead(1, 10);
    expect(repo.updateReadStatus).not.toHaveBeenCalled();

    (repo.findByIdForUser as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    await svc.markRead(1, 10);
    expect(repo.updateReadStatus).toHaveBeenCalledWith(10, true);
  });

  it("markManyRead calls repo", async () => {
    await svc.markManyRead(2, [1,2,3]);
    expect(repo.markManyRead).toHaveBeenCalledWith(2, [1,2,3]);
  });

  it("unreadCount returns count", async () => {
    (repo.countByFilters as jest.Mock).mockResolvedValue(5);
    const res = await svc.unreadCount(3);
    expect(repo.countByFilters).toHaveBeenCalledWith({ userId: 3, read: false });
    expect(res).toBe(5);
  });
});
