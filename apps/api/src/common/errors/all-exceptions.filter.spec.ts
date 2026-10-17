import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from './app.exception';

describe('AllExceptionsFilter', () => {
  const prod = new AllExceptionsFilter(false);
  const dev = new AllExceptionsFilter(true);

  beforeAll(() => {
    // Silence the expected error logs for unexpected exceptions.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterAll(() => jest.restoreAllMocks());

  it('keeps AppException code, status and details', () => {
    const details = { metric: 'OUTFIT_GENERATION', limit: 3, used: 3 };
    const { status, body } = prod.toErrorBody(
      new AppException('LIMIT_REACHED', 'Weekly limit reached', details),
    );
    expect(status).toBe(402);
    expect(body).toEqual({
      error: { code: 'LIMIT_REACHED', message: 'Weekly limit reached', details },
    });
  });

  it('maps framework HTTP exceptions to error codes', () => {
    expect(prod.toErrorBody(new NotFoundException()).body.error.code).toBe('NOT_FOUND');
    expect(prod.toErrorBody(new ForbiddenException()).body.error.code).toBe('FORBIDDEN');
  });

  it('hides internal error messages in production', () => {
    const { status, body } = prod.toErrorBody(new Error('db password is hunter2'));
    expect(status).toBe(500);
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('shows internal messages in development, never stack traces', () => {
    const { body } = dev.toErrorBody(new Error('boom'));
    expect(body.error.message).toBe('boom');
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});
