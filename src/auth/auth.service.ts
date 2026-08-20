import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

// Shape returned to the client — never includes the password hash.
export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string; user: PublicUser }> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name ?? null, passwordHash },
      });
      return { token: this.sign(user.id, user.email), user: this.toPublic(user) };
    } catch (e) {
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('An account with that email already exists');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<{ token: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    return { token: this.sign(user.id, user.email), user: this.toPublic(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Session no longer valid');
    return this.toPublic(user);
  }

  private sign(userId: string, email: string): string {
    return this.jwt.sign({ sub: userId, email });
  }

  private toPublic(user: { id: string; email: string; name: string | null }): PublicUser {
    return { id: user.id, email: user.email, name: user.name };
  }
}
