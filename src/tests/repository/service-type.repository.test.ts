import { SelectQueryBuilder } from "typeorm";

import { ServiceType } from "../../models/service-type";
import { ServiceTypeRepository } from "../../repositories/service-type.repository";
import { PaginatedServiceTypeQueryType } from "../../schema";

describe("ServiceTypeRepository - findManyWithServiceTypeAndFilter", () => {
  let qb = undefined;

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
    };
    jest.spyOn(ServiceTypeRepository, "createQueryBuilder").mockReturnValue(qb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should build query and return data with search, withDeleted, and withUnPublished=false", async () => {
    const query = {
      order: "desc",
      page: 2,
      pageSize: 5,
      search: "test",
      sort: "name",
      withDeleted: true,
      withUnPublished: false,
    };
    const expectedResult = { data: [{ id: 1 }], total: 1 };
    qb.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);

    const result = await ServiceTypeRepository.findManyWithServiceTypeAndFilter(
      query as PaginatedServiceTypeQueryType,
    );

    expect(ServiceTypeRepository.createQueryBuilder).toHaveBeenCalledWith(
      "serviceType",
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "serviceType.category",
      "category",
    );
    expect(qb.orderBy).toHaveBeenCalledWith("serviceType.name", "DESC");
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
    expect(qb.withDeleted).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith(
      "serviceType.name ILIKE :search OR serviceType.description ILIKE :search",
      { search: "%test%" },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      "serviceType.publishedAt IS NOT NULL",
    );
    expect(qb.getManyAndCount).toHaveBeenCalled();
    expect(result).toEqual(expectedResult);
  });

  it("should build query and return data with search, withDeleted, and withUnPublished=true", async () => {
    const query = {
      order: "desc",
      page: 2,
      pageSize: 5,
      search: "test",
      sort: "name",
      withDeleted: true,
      withUnPublished: true,
    };
    const expectedResult = { data: [{ id: 1 }], total: 1 };
    qb.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);

    const result = await ServiceTypeRepository.findManyWithServiceTypeAndFilter(
      query as PaginatedServiceTypeQueryType,
    );

    expect(qb.where).toHaveBeenCalledWith(
      "serviceType.name ILIKE :search OR serviceType.description ILIKE :search",
      { search: "%test%" },
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      "serviceType.publishedAt IS NOT NULL",
    );
    expect(result).toEqual(expectedResult);
  });

  it("should build query and return data without search and withUnPublished=false", async () => {
    const query = {
      order: "asc",
      page: 1,
      pageSize: 10,
      search: "",
      sort: "id",
      withDeleted: false,
      withUnPublished: false,
    };
    qb.getManyAndCount.mockResolvedValue([[{ id: 2 }], 1]);

    const result = await ServiceTypeRepository.findManyWithServiceTypeAndFilter(
      query as PaginatedServiceTypeQueryType,
    );

    expect(qb.where).toHaveBeenCalledWith(
      "serviceType.publishedAt IS NOT NULL",
    );
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [{ id: 2 }], total: 1 });
  });

  it("should build query and return data without search and withUnPublished=true", async () => {
    const query = {
      order: "asc",
      page: 1,
      pageSize: 10,
      search: "",
      sort: "id",
      withDeleted: false,
      withUnPublished: true,
    } as PaginatedServiceTypeQueryType;
    qb.getManyAndCount.mockResolvedValue([[{ id: 3 }], 1]);

    const result =
      await ServiceTypeRepository.findManyWithServiceTypeAndFilter(query);

    expect(qb.where).not.toHaveBeenCalledWith(
      "serviceType.publishedAt IS NOT NULL",
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [{ id: 3 }], total: 1 });
  });

  it("should handle empty result", async () => {
    const query = {
      order: "asc",
      page: 1,
      pageSize: 10,
      search: "",
      sort: "id",
      withDeleted: false,
      withUnPublished: true,
    };
    qb.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await ServiceTypeRepository.findManyWithServiceTypeAndFilter(
      query as PaginatedServiceTypeQueryType,
    );

    expect(result).toEqual({ data: [], total: 0 });
  });
});

describe("ServiceTypeRepository - findOneWithRelationsIncludingDeleted", () => {
  let qb = undefined;

  beforeEach(() => {
    qb = {
      getOne: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
    };
    jest.spyOn(ServiceTypeRepository, "createQueryBuilder").mockReturnValue(qb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should join relations and apply where clause", async () => {
    const options = { where: { id: 1 } };
    const expectedEntity = { id: 1, name: "Test" };
    qb.getOne.mockResolvedValue(expectedEntity);

    const result =
      await ServiceTypeRepository.findOneWithRelationsIncludingDeleted(
        options,
        ["category"],
      );

    expect(ServiceTypeRepository.createQueryBuilder).toHaveBeenCalledWith(
      "serviceType",
    );
    expect(qb.withDeleted).toHaveBeenCalled();
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "serviceType.category",
      "category",
    );
    expect(qb.where).toHaveBeenCalledWith(options.where);
    expect(qb.getOne).toHaveBeenCalled();
    expect(result).toBe(expectedEntity);
  });

  it("should join multiple relations", async () => {
    const options = {};
    qb.getOne.mockResolvedValue({ id: 2 });

    const result =
      await ServiceTypeRepository.findOneWithRelationsIncludingDeleted(
        options,
        ["category", "otherRelation"] as unknown as "category"[],
      );

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "serviceType.category",
      "category",
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "serviceType.otherRelation",
      "otherRelation",
    );
    expect(qb.where).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 2 });
  });

  it("should handle no relations and no where clause", async () => {
    qb.getOne.mockResolvedValue({ id: 3 });

    const result =
      await ServiceTypeRepository.findOneWithRelationsIncludingDeleted();

    expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    expect(qb.where).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 3 });
  });

  it("should return undefined if not found", async () => {
    qb.getOne.mockResolvedValue(undefined);

    const result =
      await ServiceTypeRepository.findOneWithRelationsIncludingDeleted(
        { where: { id: 999 } },
        ["category"],
      );

    expect(result).toBeUndefined();
  });
});

describe("ServiceTypeRepository - permanentDeleteMany", () => {
  let manager = undefined;

  beforeEach(() => {
    manager = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it("should delete from business_service_types and ServiceType", async () => {
    const ids = [1, 2, 3];

    await ServiceTypeRepository.permanentDeleteMany(ids, manager);

    expect(manager.createQueryBuilder).toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
    expect(manager.from).toHaveBeenCalledWith("business_service_types");
    expect(manager.where).toHaveBeenCalledWith("serviceTypeId IN (:...ids)", {
      ids,
    });
    expect(manager.execute).toHaveBeenCalled();

    expect(manager.from).toHaveBeenCalledWith(ServiceType);
    expect(manager.where).toHaveBeenCalledWith({ id: expect.any(Object) });
    expect(manager.execute).toHaveBeenCalled();
  });

  it("should propagate errors from manager.execute", async () => {
    manager.execute.mockRejectedValueOnce(new Error("Delete error"));

    await expect(
      ServiceTypeRepository.permanentDeleteMany([1], manager),
    ).rejects.toThrow("Delete error");
  });
});

describe("ServiceTypeRepository - softDeleteMany", () => {
  let qb = undefined;

  beforeEach(() => {
    qb = {
      execute: jest.fn(),
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    jest.spyOn(ServiceTypeRepository, "createQueryBuilder").mockReturnValue(qb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should update deletedAt for provided ids", async () => {
    qb.execute.mockResolvedValue(undefined);
    const ids = [1, 2, 3];

    await ServiceTypeRepository.softDeleteMany(ids);

    expect(qb.update).toHaveBeenCalledWith(ServiceType);
    expect(qb.set).toHaveBeenCalledWith({ deletedAt: expect.any(Function) });
    expect(qb.where).toHaveBeenCalledWith({
      /* eslint-disable @typescript-eslint/naming-convention */
      id: expect.objectContaining({ _type: "in", _value: ids }),
    });
    expect(qb.execute).toHaveBeenCalled();
  });

  it("should propagate errors from execute", async () => {
    qb.execute.mockRejectedValueOnce(new Error("Soft delete error"));

    await expect(ServiceTypeRepository.softDeleteMany([1])).rejects.toThrow(
      "Soft delete error",
    );
  });

  it("should handle empty ids array", async () => {
    qb.execute.mockResolvedValue(undefined);

    await ServiceTypeRepository.softDeleteMany([]);

    expect(qb.where).toHaveBeenCalledWith({
      /* eslint-disable @typescript-eslint/naming-convention */
      id: expect.objectContaining({ _type: "in", _value: [] }),
    });
    expect(qb.execute).toHaveBeenCalled();
  });
});

describe("ServiceTypeRepository - restoreMany", () => {
  let qb = undefined;

  beforeEach(() => {
    qb = {
      execute: jest.fn(),
      restore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    } as unknown as SelectQueryBuilder<ServiceType>;
    jest.spyOn(ServiceTypeRepository, "createQueryBuilder").mockReturnValue(qb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should restore and return raw restored entities", async () => {
    const ids = [1, 2, 3];
    const rawEntities = [{ id: 1 }, { id: 2 }];
    (qb.execute as jest.Mock).mockResolvedValue({ raw: rawEntities });

    const result = await ServiceTypeRepository.restoreMany(ids);

    expect(ServiceTypeRepository.createQueryBuilder).toHaveBeenCalled();
    expect(qb.restore).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith({
      id: expect.objectContaining({ _type: "in", _value: ids }),
    });
    expect(qb.returning).toHaveBeenCalledWith("*");
    expect(qb.execute).toHaveBeenCalled();
    expect(result).toBe(rawEntities);
  });

  it("should propagate errors from execute", async () => {
    (qb.execute as jest.Mock).mockRejectedValue(new Error("Restore error"));

    await expect(ServiceTypeRepository.restoreMany([1])).rejects.toThrow(
      "Restore error",
    );
    expect(qb.execute).toHaveBeenCalled();
  });

  it("should handle empty ids array", async () => {
    (qb.execute as jest.Mock).mockResolvedValue({ raw: [] });

    const result = await ServiceTypeRepository.restoreMany([]);
    expect(qb.where).toHaveBeenCalledWith({
      id: expect.objectContaining({ _type: "in", _value: [] }),
    });
    expect(result).toEqual([]);
  });
});
