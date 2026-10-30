import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Notification } from "../types";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ notifications: Notification[]; unreadCount: number }>("/notifications");
      setNotifications(result.notifications); setUnreadCount(result.unreadCount);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function markRead(id: string, read: boolean) {
    setBusyId(id); setError(""); setMessage("");
    try {
      const result = await api<{ notification: Notification }>("/notifications/" + id, { method: "PATCH", body: { read } });
      setNotifications((current) => current.map((item) => item.id === id ? result.notification : item));
      setUnreadCount((current) => Math.max(0, current + (read ? -1 : 1)));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(""); }
  }
  async function markAllRead() {
    setBusyId("all"); setError(""); setMessage("");
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0); setMessage("All notifications marked as read.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(""); }
  }
  if (loading) return <Loading label="Loading your notifications" />;
  return <>
    <AppHeader title="Updates in one place" eyebrow="Notifications">
      <p className="heading-description">Application updates and recruiter activity for your account. You control what you mark as read.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    <section className="form-panel notification-panel">
      <div className="section-title-inline"><div><p className="eyebrow">Your updates</p><h2>{unreadCount} unread</h2></div><button className="button button-secondary button-small" onClick={() => void markAllRead()} disabled={!unreadCount || busyId !== ""}><CheckCheck size={14} />Mark all read</button></div>
      {notifications.length === 0 ? <EmptyState title="No notifications yet." body="Application and recruiter updates will appear here." /> : <div className="notification-list">{notifications.map((item) => <article className={"notification-item" + (item.readAt ? " notification-read" : " notification-unread")} key={item.id}><span className="notification-icon"><Bell size={17} /></span><div className="notification-copy"><h3>{item.title}</h3><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>{<button className="icon-button" onClick={() => void markRead(item.id, !item.readAt)} disabled={busyId !== ""} aria-label={item.readAt ? "Mark as unread" : "Mark as read"}>{item.readAt ? <Bell size={15} /> : <Check size={16} />}</button>}</article>)}</div>}
    </section>
  </>;
}
