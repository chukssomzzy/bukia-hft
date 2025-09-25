import { EntityManager } from "typeorm";

import { ServiceTypeRepository } from "../../repositories/service-type.repository";
import {
  PaginatedServiceTypeQueryType,
  PaginatedServiceTypeResponseSchema,
} from "../../schema/service-type.schema";
import { ServiceTypeService } from "../../services/service-type.services";

jest.mock("../../repositories/service-type.repository");

describe("ServiceTypeService - createServiceType", () => {
  const service = new ServiceTypeService();

  const validData = {
    categoryId: 1,
    createdById: 42,
    description: "A test service type",
    name: "Test Service",
    publishedAt: new Date(),
  };

  const savedEntity = {
    category: { id: 1, name: "Test Category" },
    categoryId: 1,
    createdById: validData.createdById,
    description: "A test service type",
    id: 1,
    name: "Test Service",
    publishedAt: validData.publishedAt,
  };

  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    parseSpy = jest.spyOn(ServiceTypeSchema, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("should create and save a service type, returning parsed result", async () => {
    (ServiceTypeRepository.create as jest.Mock).mockReturnValue(validData);
    (ServiceTypeRepository.save as jest.Mock).mockResolvedValue(savedEntity);
    parseSpy.mockReturnValue(savedEntity);

    const result = await service.createServiceType(validData);

    expect(ServiceTypeRepository.create).toHaveBeenCalledWith(validData);
    expect(ServiceTypeRepository.save).toHaveBeenCalledWith(validData);
    expect(ServiceTypeSchema.parse).toHaveBeenCalledWith(savedEntity);
    expect(result).toBe(savedEntity);
  });

  it("should propagate errors from repository save", async () => {
    (ServiceTypeRepository.create as jest.Mock).mockReturnValue(validData);
    (ServiceTypeRepository.save as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    await expect(service.createServiceType(validData)).rejects.toThrow(
      "DB error",
    );
    expect(ServiceTypeRepository.create).toHaveBeenCalledWith(validData);
    expect(ServiceTypeRepository.save).toHaveBeenCalledWith(validData);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it("should propagate errors from schema parse", async () => {
    (ServiceTypeRepository.create as jest.Mock).mockReturnValue(validData);
    (ServiceTypeRepository.save as jest.Mock).mockResolvedValue(savedEntity);
    parseSpy.mockImplementation(() => {
      throw new Error("Parse error");
    });

    await expect(service.createServiceType(validData)).rejects.toThrow(
      "Parse error",
    );
    expect(ServiceTypeRepository.create).toHaveBeenCalledWith(validData);
    expect(ServiceTypeRepository.save).toHaveBeenCalledWith(validData);
    expect(ServiceTypeSchema.parse).toHaveBeenCalledWith(savedEntity);
  });
});

describe("ServiceTypeService - getServiceTypeById", () => {
  const service = new ServiceTypeService();

  const foundEntity = {
    category: { id: 1, name: "Test Category" },
    categoryId: 1,
    description: "A test service type",
    id: 1,
    name: "Test Service",
  };

  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    parseSpy = jest.spyOn(ServiceTypeSchema, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("should return parsed service type if found", async () => {
    (
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(foundEntity);
    parseSpy.mockReturnValue(foundEntity);

    const result = await service.getServiceTypeById(1);

    expect(
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted,
    ).toHaveBeenCalledWith({ where: { id: 1 } }, ["category"]);
    expect(ServiceTypeSchema.parse).toHaveBeenCalledWith(foundEntity);
    expect(result).toBe(foundEntity);
  });

  it("should throw ResourceNotFound if service type not found", async () => {
    (
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(undefined);

    await expect(service.getServiceTypeById(999)).rejects.toThrow(
      "service type not found",
    );
    expect(
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted,
    ).toHaveBeenCalledWith({ where: { id: 999 } }, ["category"]);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it("should throw if ServiceTypeSchema.parse fails", async () => {
    (
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted as jest.Mock
    ).mockResolvedValue(foundEntity);
    parseSpy.mockImplementation(() => {
      throw new Error("Validation error");
    });

    await expect(service.getServiceTypeById(1)).rejects.toThrow(
      "Validation error",
    );
    expect(
      ServiceTypeRepository.findOneWithRelationsIncludingDeleted,
    ).toHaveBeenCalledWith({ where: { id: 1 } }, ["category"]);
    expect(ServiceTypeSchema.parse).toHaveBeenCalledWith(foundEntity);
  });
});

describe("ServiceTypeService - getServiceTypes", () => {
  const service = new ServiceTypeService();

  const query = {
    order: "asc",
    page: 1,
    pageSize: 10,
    search: "Test",
    sort: "name",
    withDeleted: false,
  } as PaginatedServiceTypeQueryType;

  const repoResult = {
    data: [
      {
        category: { id: 1, name: "Test Category" },
        categoryId: 1,
        description: "A test service type",
        id: 1,
        name: "Test Service",
      },
    ],
    total: 1,
  };

  const parsedResult = {
    data: repoResult.data,
    page: query.page,
    pageSize: query.pageSize,
    total: repoResult.total,
  };

  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    parseSpy = jest.spyOn(PaginatedServiceTypeResponseSchema, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("should return paginated and parsed service types", async () => {
    (
      ServiceTypeRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue(repoResult);
    parseSpy.mockReturnValue(parsedResult);

    const result = await service.getServiceTypes(query);

    expect(
      ServiceTypeRepository.findManyWithServiceTypeAndFilter,
    ).toHaveBeenCalledWith(query);
    expect(PaginatedServiceTypeResponseSchema.parse).toHaveBeenCalledWith({
      data: repoResult.data,
      page: query.page,
      pageSize: query.pageSize,
      total: repoResult.total,
    });
    expect(result).toBe(parsedResult);
  });

  it("should throw if schema parse fails", async () => {
    (
      ServiceTypeRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue(repoResult);
    parseSpy.mockImplementation(() => {
      throw new Error("Validation error");
    });

    await expect(service.getServiceTypes(query)).rejects.toThrow(
      "Validation error",
    );
    expect(
      ServiceTypeRepository.findManyWithServiceTypeAndFilter,
    ).toHaveBeenCalledWith(query);
    expect(PaginatedServiceTypeResponseSchema.parse).toHaveBeenCalled();
  });

  it("should handle empty data result", async () => {
    const emptyRepoResult = { data: [], total: 0 };
    const emptyParsedResult = {
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
    };
    (
      ServiceTypeRepository.findManyWithServiceTypeAndFilter as jest.Mock
    ).mockResolvedValue(emptyRepoResult);
    parseSpy.mockReturnValue(emptyParsedResult);

    const result = await service.getServiceTypes(query);

    expect(
      ServiceTypeRepository.findManyWithServiceTypeAndFilter,
    ).toHaveBeenCalledWith(query);
    expect(PaginatedServiceTypeResponseSchema.parse).toHaveBeenCalledWith({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
    });
    expect(result).toBe(emptyParsedResult);
  });
});

jest.mock("../../utils/db", () => ({
  Transactional:
    () => (_target, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

describe("ServiceTypeService - permanentDeleteServiceTypesByIds", () => {
  const service = new ServiceTypeService();

  const idsData = { ids: [1, 2, 3] };
  const mockManager = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call permanentDeleteMany with ids and manager", async () => {
    (ServiceTypeRepository.permanentDeleteMany as jest.Mock).mockResolvedValue(
      undefined,
    );

    await service.permanentDeleteServiceTypesByIds(
      idsData,
      mockManager as EntityManager,
    );

    expect(ServiceTypeRepository.permanentDeleteMany).toHaveBeenCalledWith(
      idsData.ids,
      mockManager,
    );
  });

  it("should call permanentDeleteMany with ids and no manager", async () => {
    (ServiceTypeRepository.permanentDeleteMany as jest.Mock).mockResolvedValue(
      undefined,
    );

    await service.permanentDeleteServiceTypesByIds(idsData);

    expect(ServiceTypeRepository.permanentDeleteMany).toHaveBeenCalledWith(
      idsData.ids,
      undefined,
    );
  });

  it("should propagate errors from permanentDeleteMany", async () => {
    (ServiceTypeRepository.permanentDeleteMany as jest.Mock).mockRejectedValue(
      new Error("Delete error"),
    );

    await expect(
      service.permanentDeleteServiceTypesByIds(
        idsData,
        mockManager as EntityManager,
      ),
    ).rejects.toThrow("Delete error");
    expect(ServiceTypeRepository.permanentDeleteMany).toHaveBeenCalledWith(
      idsData.ids,
      mockManager,
    );
  });
});

describe("ServiceTypeService - softDeleteServiceTypesByIds", () => {
  const service = new ServiceTypeService();

  const idsData = { ids: [4, 5, 6] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call softDeleteMany with ids", async () => {
    (ServiceTypeRepository.softDeleteMany as jest.Mock).mockResolvedValue(
      undefined,
    );

    await service.softDeleteServiceTypesByIds(idsData);

    expect(ServiceTypeRepository.softDeleteMany).toHaveBeenCalledWith(
      idsData.ids,
    );
  });

  it("should propagate errors from softDeleteMany", async () => {
    (ServiceTypeRepository.softDeleteMany as jest.Mock).mockRejectedValue(
      new Error("Soft delete error"),
    );

    await expect(service.softDeleteServiceTypesByIds(idsData)).rejects.toThrow(
      "Soft delete error",
    );
    expect(ServiceTypeRepository.softDeleteMany).toHaveBeenCalledWith(
      idsData.ids,
    );
  });
});

import { ServiceTypeSchema } from "../../schema/service-type.base.schema";
import { RestoreServiceTypesResponseSchema } from "../../schema/service-type.schema";

describe("ServiceTypeService - restoreServicesByIds", () => {
  const service = new ServiceTypeService();

  const idsData = { ids: [1, 2, 3] };
  const restoredEntities = [
    {
      category: { id: 1, name: "Cat 1" },
      categoryId: 1,
      description: "Desc 1",
      id: 1,
      name: "Service One",
    },
    {
      category: { id: 2, name: "Cat 2" },
      categoryId: 2,
      description: "Desc 2",
      id: 2,
      name: "Service Two",
    },
  ];

  let repoSpy: jest.SpyInstance;
  let parseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    repoSpy = jest.spyOn(ServiceTypeRepository, "restoreMany");
    parseSpy = jest.spyOn(RestoreServiceTypesResponseSchema, "parse");
  });

  afterEach(() => {
    repoSpy.mockRestore();
    parseSpy.mockRestore();
  });

  it("should restore and parse service types", async () => {
    repoSpy.mockResolvedValue(restoredEntities);
    parseSpy.mockReturnValue(restoredEntities);

    const result = await service.restoreServicesByIds(idsData);

    expect(repoSpy).toHaveBeenCalledWith(idsData.ids);
    expect(parseSpy).toHaveBeenCalledWith(restoredEntities);
    expect(result).toBe(restoredEntities);
  });

  it("should propagate errors from repository", async () => {
    repoSpy.mockRejectedValue(new Error("Restore error"));

    await expect(service.restoreServicesByIds(idsData)).rejects.toThrow(
      "Restore error",
    );
    expect(repoSpy).toHaveBeenCalledWith(idsData.ids);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it("should throw if schema parse fails", async () => {
    repoSpy.mockResolvedValue(restoredEntities);
    parseSpy.mockImplementation(() => {
      throw new Error("Validation error");
    });

    await expect(service.restoreServicesByIds(idsData)).rejects.toThrow(
      "Validation error",
    );
    expect(repoSpy).toHaveBeenCalledWith(idsData.ids);
    expect(parseSpy).toHaveBeenCalledWith(restoredEntities);
  });
});
