import { FindManyOptions, FindOneOptions } from "typeorm";

import { Category } from "../../models/service-category";
import { ServiceCategoryRepository } from "../../repositories/service-category.repository";
import { PaginatedCategoryQueryType } from "../../schema";

describe("ServiceCategoryRepository.findManyWithServiceType - introspective and branch coverage", () => {
  const mockCategories = [
    {
      createdAt: new Date(),
      deletedAt: null,
      description: "desc",
      id: 1,
      name: "Cleaning",
      serviceTypes: [],
      updatedAt: new Date(),
    },
    {
      createdAt: new Date(),
      deletedAt: null,
      description: "desc",
      id: 2,
      name: "Laundry",
      serviceTypes: [],
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls find with relations even if options is undefined", async () => {
    const findMock = jest
      .spyOn(ServiceCategoryRepository, "find")
      .mockResolvedValue(mockCategories as Category[]);
    await ServiceCategoryRepository.findManyWithServiceType(undefined);
    expect(findMock).toHaveBeenCalledWith({ relations: ["serviceTypes"] });
    findMock.mockRestore();
  });

  it("merges relations with provided options", async () => {
    const findMock = jest
      .spyOn(ServiceCategoryRepository, "find")
      .mockResolvedValue(mockCategories as Category[]);
    const options: FindManyOptions<Category> = {
      take: 1,
      where: { name: "Laundry" },
    };
    await ServiceCategoryRepository.findManyWithServiceType(options);
    expect(findMock).toHaveBeenCalledWith({
      ...options,
      relations: ["serviceTypes"],
    });
    findMock.mockRestore();
  });

  it("returns empty array when no categories are found", async () => {
    const findMock = jest
      .spyOn(ServiceCategoryRepository, "find")
      .mockResolvedValue([]);
    const result = await ServiceCategoryRepository.findManyWithServiceType({
      where: { name: "NonExistent" },
    });
    expect(result).toEqual([]);
    findMock.mockRestore();
  });

  it("throws and propagates error from repository", async () => {
    const findMock = jest
      .spyOn(ServiceCategoryRepository, "find")
      .mockRejectedValue(new Error("DB error"));
    await expect(
      ServiceCategoryRepository.findManyWithServiceType({}),
    ).rejects.toThrow("DB error");
    findMock.mockRestore();
  });

  it("handles options with additional properties", async () => {
    const findMock = jest
      .spyOn(ServiceCategoryRepository, "find")
      .mockResolvedValue(mockCategories as Category[]);
    const options: FindManyOptions<Category> = {
      order: { id: "DESC" },
      skip: 1,
      where: { name: "Cleaning" },
    };
    await ServiceCategoryRepository.findManyWithServiceType(options);
    expect(findMock).toHaveBeenCalledWith({
      ...options,
      relations: ["serviceTypes"],
    });
    findMock.mockRestore();
  });
});

describe("ServiceCategoryRepository.findManyWithServiceTypeAndFilter", () => {
  const mockQuery: PaginatedCategoryQueryType = {
    order: "asc",
    page: 1,
    pageSize: 10,
    search: "cleaning",
    sort: "name",
    withDeleted: false,
    withUnPublished: false,
  };

  const mockCategories = [
    {
      createdAt: new Date(),
      deletedAt: null,
      description: "desc",
      id: 1,
      name: "Cleaning",
      serviceTypes: [],
      updatedAt: new Date(),
    },
    {
      createdAt: new Date(),
      deletedAt: null,
      description: "desc",
      id: 2,
      name: "Laundry",
      serviceTypes: [],
      updatedAt: new Date(),
    },
  ];

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
    jest
      .spyOn(ServiceCategoryRepository, "createQueryBuilder")
      .mockReturnValue(qb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns paginated data and total count (happy path, withUnPublished=false)", async () => {
    qb.getManyAndCount.mockResolvedValue([mockCategories, 2]);
    const result =
      await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(
        mockQuery,
      );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "category.serviceTypes",
      "serviceType",
    );
    expect(qb.orderBy).toHaveBeenCalledWith("category.name", "ASC");
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.where).toHaveBeenCalledWith(
      "category.name ILIKE :search OR category.description ILIKE :search",
      { search: `%${mockQuery.search}%` },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      "category.publishedAt IS NOT NULL",
    );
    expect(result).toEqual({ data: mockCategories, total: 2 });
  });

  it("returns paginated data and total count (withUnPublished=true)", async () => {
    qb.getManyAndCount.mockResolvedValue([mockCategories, 2]);
    const query = { ...mockQuery, withUnPublished: true };
    const result =
      await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(query);
    expect(qb.where).toHaveBeenCalledWith(
      "category.name ILIKE :search OR category.description ILIKE :search",
      { search: `%${mockQuery.search}%` },
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      "category.publishedAt IS NOT NULL",
    );
    expect(result).toEqual({ data: mockCategories, total: 2 });
  });

  it("calls withDeleted if withDeleted is true", async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    const query = { ...mockQuery, withDeleted: true };
    await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(query);
    expect(qb.withDeleted).toHaveBeenCalled();
  });

  it("does not call where if search is not provided and withUnPublished=true", async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    const query = { ...mockQuery, search: undefined, withUnPublished: true };
    await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(query);
    expect(qb.where).not.toHaveBeenCalledWith(
      "category.publishedAt IS NOT NULL",
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it("calls where with published filter if search is not provided and withUnPublished=false", async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    const query = { ...mockQuery, search: undefined, withUnPublished: false };
    await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(query);
    expect(qb.where).toHaveBeenCalledWith("category.publishedAt IS NOT NULL");
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it("uses DESC order when specified", async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    const query = { ...mockQuery, order: "desc" };
    await ServiceCategoryRepository.findManyWithServiceTypeAndFilter(
      query as PaginatedCategoryQueryType,
    );
    expect(qb.orderBy).toHaveBeenCalledWith("category.name", "DESC");
  });

  it("throws if getManyAndCount fails", async () => {
    qb.getManyAndCount.mockRejectedValue(new Error("DB error"));
    await expect(
      ServiceCategoryRepository.findManyWithServiceTypeAndFilter(mockQuery),
    ).rejects.toThrow("DB error");
  });
});

interface MockQueryBuilder {
  getOne: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  where: jest.Mock;
  withDeleted: jest.Mock;
}

describe("ServiceCategoryRepository.findOneWithRelationsIncludingDeleted (explicit types)", () => {
  let qb: MockQueryBuilder;
  const mockCategory = {
    createdAt: new Date(),
    deletedAt: null,
    description: "desc",
    id: 1,
    name: "Cleaning",
    serviceTypes: [],
    updatedAt: new Date(),
  };

  beforeEach(() => {
    qb = {
      getOne: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
    };
    jest
      .spyOn(ServiceCategoryRepository, "createQueryBuilder")
      .mockReturnValue(
        qb as unknown as ReturnType<
          typeof ServiceCategoryRepository.createQueryBuilder
        >,
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns category with requested relations (happy path)", async () => {
    qb.getOne.mockResolvedValue(mockCategory);
    const options: FindOneOptions<Category> = { where: { id: 1 } };
    const relations: Array<"serviceTypes"> = ["serviceTypes"];
    const result =
      await ServiceCategoryRepository.findOneWithRelationsIncludingDeleted(
        options,
        relations,
      );
    expect(qb.withDeleted).toHaveBeenCalled();
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      "category.serviceTypes",
      "serviceTypes",
    );
    expect(qb.where).toHaveBeenCalledWith(options.where);
    expect(result).toEqual(mockCategory);
  });

  it("returns category with no relations if relations array is empty", async () => {
    qb.getOne.mockResolvedValue(mockCategory);
    const options: FindOneOptions<Category> = { where: { id: 1 } };
    const relations: Array<"serviceTypes"> = [];
    const result =
      await ServiceCategoryRepository.findOneWithRelationsIncludingDeleted(
        options,
        relations,
      );
    expect(qb.withDeleted).toHaveBeenCalled();
    expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith(options.where);
    expect(result).toEqual(mockCategory);
  });

  it("does not call where if options.where is not provided", async () => {
    qb.getOne.mockResolvedValue(mockCategory);
    const options: FindOneOptions<Category> = {};
    const relations: Array<"serviceTypes"> = ["serviceTypes"];
    await ServiceCategoryRepository.findOneWithRelationsIncludingDeleted(
      options,
      relations,
    );
    expect(qb.where).not.toHaveBeenCalled();
  });

  it("throws if getOne fails", async () => {
    qb.getOne.mockRejectedValue(new Error("DB error"));
    const options: FindOneOptions<Category> = { where: { id: 1 } };
    const relations: Array<"serviceTypes"> = ["serviceTypes"];
    await expect(
      ServiceCategoryRepository.findOneWithRelationsIncludingDeleted(
        options,
        relations,
      ),
    ).rejects.toThrow("DB error");
  });
});

describe("ServiceCategoryRepository.findOneWithServiceType", () => {
  const mockCategory = {
    createdAt: new Date(),
    deletedAt: null,
    description: "desc",
    id: 1,
    name: "Cleaning",
    serviceTypes: [],
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns category with serviceTypes (happy path)", async () => {
    const findOneMock = jest
      .spyOn(ServiceCategoryRepository, "findOne")
      .mockResolvedValue(mockCategory as Category);
    const options: FindOneOptions<Category> = { where: { id: 1 } };
    const result =
      await ServiceCategoryRepository.findOneWithServiceType(options);
    expect(findOneMock).toHaveBeenCalledWith({
      ...options,
      relations: ["serviceTypes"],
    });
    expect(result).toEqual(mockCategory);
    findOneMock.mockRestore();
  });

  it("returns undefined if category not found", async () => {
    const findOneMock = jest
      .spyOn(ServiceCategoryRepository, "findOne")
      .mockResolvedValue(undefined);
    const options: FindOneOptions<Category> = { where: { id: 999 } };
    const result =
      await ServiceCategoryRepository.findOneWithServiceType(options);
    expect(result).toBeUndefined();
    findOneMock.mockRestore();
  });

  it("throws if repository throws error", async () => {
    const findOneMock = jest
      .spyOn(ServiceCategoryRepository, "findOne")
      .mockRejectedValue(new Error("DB error"));
    const options: FindOneOptions<Category> = { where: { id: 1 } };
    await expect(
      ServiceCategoryRepository.findOneWithServiceType(options),
    ).rejects.toThrow("DB error");
    findOneMock.mockRestore();
  });
});
