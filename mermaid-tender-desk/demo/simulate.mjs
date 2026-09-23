import { Agent } from '@openai/agents';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Runs the Mermail Tender Desk skill against the demo input.
 *
 * @returns {Promise<object>} The agent's output.
 */
export async function runSimulation() {
  // Resolve the skill markdown file relative to this script.
  const skillPath = new URL('../SKILL.md', import.meta.url);

  // Create the agent instance.
  const agent = new Agent(skillPath);

  // Load the demo input JSON.
  const inputModule = await import('./input.json', { assert: { type: 'json' } });
  const input = inputModule.default;

  // Execute the agent and return the result.
  const result = await agent.run(input);
  return result;
}

// Default export for convenience.
export default runSimulation;
