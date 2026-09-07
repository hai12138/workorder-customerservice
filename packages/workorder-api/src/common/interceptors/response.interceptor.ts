import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof Buffer || data instanceof Uint8Array || data instanceof StreamableFile) {
          return data;
        }
        return {
          code: 0,
          message: 'ok',
          data: data ?? null,
        };
      }),
    );
  }
}
