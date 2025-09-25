import { BadRequest } from "../../middleware";
import { ServiceCategoryRepository } from "../../repositories/service-category.repository";
import {
  CreateCategoryRequestType,
  DeleteCategoryRequestType,
  PaginatedCategoryQueryType,
} from "../../schema/";
import {
  GetCategoryResponseSchema,
  GetCategoryResponseType,
  PaginatedCategoryResponseSchema,
} from "../../schema/service-type.base.schema";
import { CategoryService } from "../../services/service-category.services";

jest.mock("../../repositories/service-category.repository", () => ({
  ServiceCategoryRepository: {
    create: jest.fn(),
    findManyWithServiceTypeAndFilter: jest.fn(),
    findOneWithRelationsIncludingDeleted: jest.fn(),
    findOneWithServiceType: jest.fn(),
    recover: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  },
}));

describe("CategoryService.createCategory", () => {
  const service = new CategoryService();
  const payload: CreateCategoryRequestType & {
    createdById: number;
    publishedAt: Date;
  } = {
    createdById: 99,
    description: "Cleaning services",
    name: "Cleaning",
    publishedAt: new Date(),
  };
  const savedCategory: GetCategoryResponseType = {
    deletedAt: null,
    description: "Cleaning services",
    id: 1,
    name: "Cleaning",
    publishedAt: payload.publishedAt,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new category successfully with createdById and publishedAt", async () => {
    (ServiceCategoryRepository.create as jest.Mock).mockReturnValue(payload);
    (ServiceCategoryRepository.save as jest.Mock).mockResolvedValue(
      savedCategory,
    );
    const result = await service.createCategory(payload);
    expect(ServiceCategoryRepository.create).toHaveBeenCalledWith(payload);
    expect(ServiceCategoryRepository.save).toHaveBeenCalledWith(payload);
    expect(result).toEqual(GetCategoryResponseSchema.parse(savedCategory));
  });

  it("throws if save fails", async () => {
    (ServiceCategoryRepository.create as jest.Mock).mockReturnValue(payload);
    (ServiceCategoryRepository.save as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );
    await expect(service.createCategory(payload)).rejects.toThrow("DB error");
  });

  it("throws if schema parse fails", async () => {
    (ServiceCategoryRepository.create as jest.Mock).mockReturnValue(payload);
    (ServiceCategoryRepository.save as jest.Mock).mockResolvedValue({
      invalid: "data",
    });
    await expect(service.createCategory(payload)).rejects.toThrow();
  });
});

describe("CategoryService.deleteCategory", () => {
  const service = new CategoryService();
  const payload: DeleteCategoryRequestType = { id: 1 };
  const mockCategory = { deletedAt: null, id: 1, name: "Cleaning" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes category successfully", async () => {
    (
      ServiceCategoryRepository.findOneWithServiceType as jest.Mock
    ).mockResolvedValue(mockCategory);
    (ServiceCategoryRepository.softRemove as jest.Mock).mockResolvedValue(
      undefined,
    );

    await expect(service.deleteCategory(payload)).resolves.toBeUndefined();
    expect(
      ServiceCategoryRepository.findOneWithServiceType,
    ).toHaveBeenCalledWith({ where: { id: payload.id } });
    expect(ServiceCategoryRepository.softRemove).toHaveBeenCalledWith(
      mockCategory,
    );
  });

  it("throws BadRequest if category not found", async () => {
    (
      ServiceCategoryRepository.findOneWithServiceType as jest.Mock
    ).mockResolvedValue(null);

    await expect(service.deleteCategory(payload)).rejects.toThrow(BadRequest);
    expect(ServiceCategoryRepository.softRemove).not.toHaveBeenCalled();
  });

  it("throws if softRemove fails", async () => {
    (
      ServiceCategoryRepository.findOneWithServiceType as jest.Mock
    ).mockResolvedValue(mockCategory);
    (ServiceCategoryRepository.softRemove as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    await expect(service.deleteCategory(payload)).rejects.toThrow("DB error");
    expect(ServiceCategoryRepository.softRemove).toHaveBeenCalledWith(
      mockCategory,
    );
  });
});

describe("CategoryService.getCategories", () => {
  const service = new CategoryService();
  const query: PaginatedCategoryQueryType = {
    order: "asc",
    page: 1,
    pageSize: 10,
    search: "cleaning",
    sort: "name",
    withDeleted: false,
  };

  const mockData = [
    {
      deletedAt: null,
      description: "desc",
      id: 1,
      name: "Cleaning",
      publishedAt: new Date(),
    },
    {
      deletedAt: null,
      description: "desc",
      id: 2,
      name: "Laundry",
      publishedAt: new Date(),
    },
  ];
  const mockResponse = {
    data: mockData,
    total: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns paginated categories successfully", async () => {
    (
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue(mockResponse);
    const result = await service.getCategories(query);
    expect(
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter,
    ).toHaveBeenCalledWith(query);
    expect(result).toEqual(
      PaginatedCategoryResponseSchema.parse({
        data: mockData,
        page: query.page,
        pageSize: query.pageSize,
        total: mockResponse.total,
      }),
    );
  });

  it("returns empty data if no categories found", async () => {
    (
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue({ data: [], total: 0 });
    const result = await service.getCategories(query);
    expect(result).toEqual(
      PaginatedCategoryResponseSchema.parse({
        data: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
      }),
    );
  });

  it("throws if repository throws error", async () => {
    (
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockRejectedValue(new Error("DB error"));
    await expect(service.getCategories(query)).rejects.toThrow("DB error");
  });

  it("throws if schema parse fails", async () => {
    (
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue({
      data: [{ invalid: "data" }],
      total: 1,
    });
    await expect(service.getCategories(query)).rejects.toThrow();
  });
});

describe("CategoryService.getCategoriesById", () => {
  const service = new CategoryService();
  const id = 1;
  const mockCategory: GetCategoryResponseType = {
    deletedAt: null,
    description: "desc",
    id: 1,
    name: "Cleaning",
    publishedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns category by id successfully", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(mockCategory);
    const result = await service.getCategoriesById(id);
    expect(
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted,
    ).toHaveBeenCalledWith({ where: { id: id } }, ["serviceTypes"]);
    expect(result).toEqual(GetCategoryResponseSchema.parse(mockCategory));
  });

  it("throws if repository throws error", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockRejectedValue(new Error("DB error"));
    await expect(service.getCategoriesById(id)).rejects.toThrow("DB error");
  });

  it("throws if schema parse fails", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue({ invalid: "data" });
    await expect(service.getCategoriesById(id)).rejects.toThrow();
  });
});

describe("CategoryService.restoreCategory", () => {
  const service = new CategoryService();
  const payload: DeleteCategoryRequestType = { id: 1 };
  const mockCategory = { deletedAt: new Date(), id: 1, name: "Cleaning" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("restores category successfully", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(mockCategory);
    (ServiceCategoryRepository.recover as jest.Mock).mockResolvedValue(
      undefined,
    );

    await expect(service.restoreCategory(payload)).resolves.toBeUndefined();
    expect(
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted,
    ).toHaveBeenCalledWith({ where: { id: payload.id } }, ["serviceTypes"]);
    expect(ServiceCategoryRepository.recover).toHaveBeenCalledWith(
      mockCategory,
    );
  });

  it("throws BadRequest if category not found", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(null);

    await expect(service.restoreCategory(payload)).rejects.toThrow(BadRequest);
    expect(ServiceCategoryRepository.recover).not.toHaveBeenCalled();
  });

  it("throws if recover fails", async () => {
    (
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(mockCategory);
    (ServiceCategoryRepository.recover as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    await expect(service.restoreCategory(payload)).rejects.toThrow("DB error");
    expect(ServiceCategoryRepository.recover).toHaveBeenCalledWith(
      mockCategory,
    );
  });
});
