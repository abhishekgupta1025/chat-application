import { userRepository, UserRepository } from '../repositories/userRepository';

export class UserService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async getContacts(currentUserId?: string) {
    const list = await this.userRepo.findAllExcept(currentUserId);
    return list.map((u) => ({
      _id: u.id,
      id: u.id,
      username: u.username,
      createdAt: u.createdAt
    }));
  }

  async searchUsers(query: string, currentUserId?: string) {
    const list = await this.userRepo.search(query, currentUserId);
    return list.map((u) => ({
      _id: u.id,
      id: u.id,
      username: u.username
    }));
  }
}

export const userService = new UserService();
