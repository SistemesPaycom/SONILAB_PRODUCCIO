import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    const requestId = req.requestId;
    const path = req.originalUrl || req.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;

      // Nest puede devolver string o object
      if (typeof r === 'string') {
        message = r;
      } else {
        message = r.message ?? r;
        error = r.error ?? exception.name;
      }
    } else if (exception && typeof exception === 'object') {
      const anyEx = exception as any;
      if (anyEx.message) message = anyEx.message;
      error = anyEx.name || error;
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}