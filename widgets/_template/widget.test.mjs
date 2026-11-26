import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDemo } from '../../test/harness.mjs';

test( 'greets, and greets again on click', async () => {
	const { page, close } = await openDemo( '_template' );
	// Playwright locators pierce open shadow roots.
	const button = page.getByRole( 'button' );
	assert.equal( await button.textContent(), 'Hello, world' );
	await button.click();
	assert.equal( await button.textContent(), 'Hello again, world' );
	await close();
} );
