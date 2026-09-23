import { expect } from 'chai';
import runSimulation from './simulate.mjs';

describe('Mermail Tender Desk Demo', () => {
  it('should produce a decision packet', async () => {
    const result = await runSimulation();
    expect(result).to.be.an('object');
    expect(result).to.have.property('decision');
    expect(result.decision).to.be.oneOf(['bid', 'no-bid', 'clarify']);
  });
});
