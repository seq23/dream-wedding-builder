import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertGitHubRepositoryPrivate, saveBinaryToPrivateGitHub } from '@/lib/admin-store';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env = { ...originalEnv, GITHUB_ADMIN_TOKEN:'token_test', GITHUB_REPOSITORY:'seq23/private-products', GITHUB_DEFAULT_BRANCH:'main' };
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('paid binary GitHub repository visibility gate', () => {
  it('allows the write only after GitHub reports the repository is private', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url=String(input);
      if(url==='https://api.github.com/repos/seq23/private-products') return new Response(JSON.stringify({private:true}),{status:200});
      if(url.includes('/contents/') && (!init?.method || init.method==='GET')) return new Response('{}',{status:404});
      if(url.includes('/contents/') && init?.method==='PUT') return new Response(JSON.stringify({content:{sha:'abc'}}),{status:200});
      return new Response('unexpected',{status:500});
    }) as typeof fetch;
    await expect(saveBinaryToPrivateGitHub('product-builds/releases/file.pdf',Buffer.from('paid'),'test upload')).resolves.toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('refuses a public repository even if a stale local flag claims it is private', async () => {
    process.env.GITHUB_REPOSITORY_PRIVATE='true';
    global.fetch = vi.fn(async () => new Response(JSON.stringify({private:false}),{status:200})) as typeof fetch;
    await expect(saveBinaryToPrivateGitHub('product-builds/releases/file.pdf',Buffer.from('paid'),'test upload')).rejects.toThrow('not private');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when repository metadata cannot be verified', async () => {
    global.fetch = vi.fn(async () => new Response('provider unavailable',{status:503})) as typeof fetch;
    await expect(assertGitHubRepositoryPrivate('token_test','seq23/private-products')).rejects.toThrow('Cannot verify GitHub repository visibility');
  });

  it('fails closed when GitHub returns malformed visibility metadata', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({name:'private-products'}),{status:200})) as typeof fetch;
    await expect(assertGitHubRepositoryPrivate('token_test','seq23/private-products')).rejects.toThrow('not private');
  });

  it('does not trust a false local privacy flag over live GitHub truth', async () => {
    process.env.GITHUB_REPOSITORY_PRIVATE='false';
    global.fetch = vi.fn(async () => new Response(JSON.stringify({private:true}),{status:200})) as typeof fetch;
    await expect(assertGitHubRepositoryPrivate('token_test','seq23/private-products')).resolves.toBe(true);
  });
});
