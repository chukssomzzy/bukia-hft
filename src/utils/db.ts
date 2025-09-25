import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";

export function Transactional() {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const originalMethod = descriptor.value!;
    descriptor.value = async function (
      ...args: Parameters<T>
    ): Promise<ReturnType<T>> {
      return await AppDataSource.manager.transaction(
        async (transactionManager: EntityManager) => {
          return await originalMethod.apply(this, [
            ...args,
            transactionManager,
          ]);
        },
      );
    } as T;
  };
}
