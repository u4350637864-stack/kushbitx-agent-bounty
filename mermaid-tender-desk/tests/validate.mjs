import { expect } from 'chai';
import { validateSkill } from '@openai/agents';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

describe('Mermail Tender Desk Skill Validation', () => {
  const skillPath = new URL('../SKILL.md', import.meta.url);
  it('should be a valid skill', async () => {
    const validation = await validateSkill(skillPath);
    expect(validation.errors).to.be.empty;
  });
});
