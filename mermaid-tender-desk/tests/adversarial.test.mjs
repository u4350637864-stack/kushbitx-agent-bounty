import { expect } from 'chai';
import { Agent } from '@openai/agents';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import adversarialScenarios from './adversarial-scenarios.json' assert { type: 'json' };

describe('Mermail Tender Desk Adversarial Scenarios', () => {
  const skillPath = new URL('../SKILL.md', import.meta.url);
  const agent = new Agent(skillPath);

  adversarialScenarios.forEach((scenario, idx) => {
    it(`should handle scenario ${idx + 1}: ${scenario.description}`, async () => {
      const result = await agent.run(scenario.input);
      expect(result).to.be.an('object');
      expect(result).to.have.property('decision');
      // Basic sanity check: decision must be one of the expected values.
      expect(['bid', 'no-bid', 'clarify']).to.include(result.decision);
    });
  });
});
