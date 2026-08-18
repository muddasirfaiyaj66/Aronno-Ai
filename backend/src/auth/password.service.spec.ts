import { Test } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();
    service = module.get(PasswordService);
  });

  it('hashes and verifies with argon2id', async () => {
    const hash = await service.hash('ValidPass1!');
    expect(hash).not.toContain('ValidPass1!');
    expect(await service.verify(hash, 'ValidPass1!')).toBe(true);
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });
});
