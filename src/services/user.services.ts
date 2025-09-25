import { UserRepository } from "../repositories/user.repository";
import { MeResponseSchema, MeResponseType } from "../schema";

export class UserServices {
  public async getUserById(userId: number): Promise<MeResponseType> {
    return MeResponseSchema.parse(
      await UserRepository.findWithProfile({
        where: { id: userId },
      }),
    );
  }
}
