/** Deadline for native SDK calls too: these do not necessarily honor AbortSignal. */
export async function sharingDeadline<T>(run: () => Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('No connection. Your plan is unchanged. Try sharing again when you are online.')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
