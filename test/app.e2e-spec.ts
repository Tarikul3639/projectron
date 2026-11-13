import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('does not expose an HTTP route at /', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(404)
      .expect({
        message: 'Cannot GET /',
        error: 'Not Found',
        statusCode: 404,
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
