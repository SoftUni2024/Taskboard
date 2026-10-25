// Coalesce bursts, defer while dragging/saving, and never overlap refresh requests.
export function createRefreshQueue({
  refresh,
  canRefresh = () => true,
  onError = () => {},
  delay = 180,
}) {
  let timer = null,
    running = false,
    dirty = false,
    stopped = false;
  function schedule() {
    if (stopped) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }
  async function flush() {
    timer = null;
    if (stopped || !dirty) return;
    if (running) return;
    if (!canRefresh()) {
      timer = setTimeout(flush, delay);
      return;
    }
    dirty = false;
    running = true;
    try {
      await refresh();
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      running = false;
      if (!stopped && dirty) {
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
      }
    }
  }
  return {
    schedule,
    stop() {
      stopped = true;
      dirty = false;
      clearTimeout(timer);
    },
  };
}
export function watchProjectTasks(
  client,
  project,
  {
    refresh,
    canRefresh,
    onError,
    onStatus = () => {},
    events = window,
    doc = document,
  },
) {
  const queue = createRefreshQueue({ refresh, canRefresh, onError });
  let stopped = false;
  const channel = client
    .channel(`task-board:${project}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_task_changes",
        filter: `project_id=eq.${project}`,
      },
      queue.schedule,
    )
    .subscribe((status) => {
      if (stopped) return;
      onStatus(status);
      if (status === "SUBSCRIBED") queue.schedule();
    });
  const visible = () => {
    if (!doc.hidden) queue.schedule();
  };
  events.addEventListener("focus", queue.schedule);
  events.addEventListener("online", queue.schedule);
  doc.addEventListener("visibilitychange", visible);
  // Catch up after suspended tabs or a missed socket event, including access revocation.
  const interval = setInterval(visible, 30000);
  return () => {
    stopped = true;
    queue.stop();
    clearInterval(interval);
    events.removeEventListener("focus", queue.schedule);
    events.removeEventListener("online", queue.schedule);
    doc.removeEventListener("visibilitychange", visible);
    void client.removeChannel(channel).catch(() => {});
  };
}
