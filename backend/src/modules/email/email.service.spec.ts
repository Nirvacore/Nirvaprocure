import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));

const nodemailer = require('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockSendMail: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.SMTP_HOST;
    mockSendMail = nodemailer.createTransport().sendMail;
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();
    service = module.get(EmailService);
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.FROM_NAME;
    delete process.env.FROM_EMAIL;
  });

  describe('enabled', () => {
    it('should be false when SMTP_HOST not set', () => {
      expect(service.enabled).toBe(false);
    });

    it('should be true when SMTP_HOST is set', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      expect(service.enabled).toBe(true);
    });
  });

  describe('send', () => {
    it('should skip sending when SMTP not configured', async () => {
      await service.send({ to: 'test@test.com', subject: 'Hi', text: 'Hello' });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should send email when SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      await service.send({ to: 'test@test.com', subject: 'Hi', html: '<p>Hello</p>' });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@test.com',
          subject: 'Hi',
        }),
      );
    });

    it('should not throw on SMTP error', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.send({ to: 'test@test.com', subject: 'Hi', text: 'Hello' }),
      ).resolves.not.toThrow();
    });

    it('should support array of recipients', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      mockSendMail.mockResolvedValue({ messageId: 'msg-2' });

      await service.send({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Bulk',
        text: 'Hello all',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: ['a@test.com', 'b@test.com'] }),
      );
    });
  });
});
