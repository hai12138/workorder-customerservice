import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface JwtPayload {
  sub: string;
  name: string;
  tenantId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtPayload;
    }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('缺少登录凭证');

    const secret = this.config.get<string>('JWT_SECRET') ?? 'astra-dev-secret';
    try {
      req.user = jwt.verify(token, secret) as JwtPayload;
      return true;
    } catch {
      // Dev fallback: accept legacy static API token for MCP/scripts
      const apiToken = this.config.get<string>('API_TOKEN') ?? 'dev-token-change-me';
      if (token === apiToken) {
        req.user = {
          sub: req.headers['x-user-id'] || 'admin',
          name: 'API',
          tenantId: 'default',
        };
        return true;
      }
      throw new UnauthorizedException('登录已失效');
    }
  }
}
