import { eq, ne, and, ilike, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import { users, User, NewUser } from '../db/schema';

export class UserRepository {
  async findById(id: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.username, username)
    });
  }

  async create(data: NewUser): Promise<User> {
    const [created] = await db.insert(users).values(data).returning();
    return created;
  }

  async findAllExcept(currentUserId?: string): Promise<Array<{ id: string; username: string; createdAt: Date }>> {
    return await db.query.users.findMany({
      where: currentUserId ? ne(users.id, currentUserId) : undefined,
      columns: {
        id: true,
        username: true,
        createdAt: true
      },
      orderBy: (users, { asc }) => [asc(users.username)]
    });
  }

  async search(query: string, currentUserId?: string): Promise<Array<{ id: string; username: string }>> {
    if (!query || !query.trim()) return [];

    return await db.query.users.findMany({
      where: currentUserId
        ? and(ne(users.id, currentUserId), ilike(users.username, `%${query.trim()}%`))
        : ilike(users.username, `%${query.trim()}%`),
      columns: {
        id: true,
        username: true
      },
      limit: 20
    });
  }

  async findManyByIds(ids: string[]): Promise<Array<{ id: string; username: string }>> {
    if (ids.length === 0) return [];
    return await db.query.users.findMany({
      where: inArray(users.id, ids),
      columns: { id: true, username: true }
    });
  }
}

export const userRepository = new UserRepository();
