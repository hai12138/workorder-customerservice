import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      
      if (typeof res === 'object' && res !== null && 'errors' in res) {
        response.status(status).json({
          code: status,
          message: (res as any).message || 'error',
          data: { errors: (res as any).errors },
        });
        return;
      }
      
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message ?? 'error';
      response.status(status).json({
        code: status,
        message: Array.isArray(message) ? message.join('; ') : message,
        data: null,
      });
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 500,
      message: 'Internal server error',
      data: null,
    });
  }
}
