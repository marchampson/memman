import { execSync } from 'node:child_process';

export interface GitFileInfo {
  path: string;
  lastModified: Date | null;
  exists: boolean;
}

/**
 * Check if files referenced by memory entries still exist in the git repo
 */
export function checkFilesExist(
  projectRoot: string,
  paths: string[],
): Map<string, boolean> {
  const result = new Map<string, boolean>();

  try {
    const gitFiles = execSync('git ls-files', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim().split('\n').filter(Boolean);

    const gitFileSet = new Set(gitFiles);

    for (const path of paths) {
      if (path.includes('*')) {
        // Glob pattern - check if any files match
        const regex = globToRegex(path);
        const hasMatch = gitFiles.some(f => regex.test(f));
        result.set(path, hasMatch);
      } else {
        result.set(path, gitFileSet.has(path));
      }
    }
  } catch {
    // Not a git repo or git not available
    for (const path of paths) {
      result.set(path, true); // Assume exists if we can't check
    }
  }

  return result;
}

/**
 * Get the last modification time for a file from git log
 */
export function getLastModified(
  projectRoot: string,
  filePath: string,
): Date | null {
  try {
    const output = execSync(`git log -1 --format="%aI" -- "${filePath}"`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (!output) return null;
    return new Date(output);
  } catch {
    return null;
  }
}

/**
 * Get recently modified files (for context injection)
 */
export function getRecentlyModifiedFiles(
  projectRoot: string,
  since: string = '7 days ago',
  limit = 20,
): string[] {
  try {
    const output = execSync(
      `git log --since="${since}" --diff-filter=AMCR --name-only --pretty=format: | sort -u | head -${limit}`,
      {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 10000,
      },
    );

    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function globToRegex(pattern: string): RegExp {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`);
}
