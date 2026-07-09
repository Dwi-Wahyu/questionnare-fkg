import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { toast } from "../../components/ui/useToast";
import { getSessionFn, logoutFn } from "../../server/authFunctions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const user = await getSessionFn();
    if (!user || (user.role !== "admin" && user.role !== "visitor")) {
      toast.error(
        "Akses ditolak. Anda harus masuk sebagai Admin atau Visitor.",
      );
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AdminLayoutComponent,
});

function AdminLayoutComponent() {
  const { user } = Route.useRouteContext();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutFn();
    toast.success("Keluar dari Admin Panel.");
    await router.invalidate();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="bg-[#faf8ff] text-[#1a1b21] min-h-screen flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <header className="bg-white border-b border-[#c4c6d4] sticky top-0 left-0 right-0 flex justify-between items-center h-16 px-6 z-30 shadow-sm w-full">
        <div className="flex items-center gap-8">
          <Link to="/admin/surveys" className="flex items-center gap-3">
            <img
              alt="Universitas Hasanuddin Logo"
              className="h-9 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlbiwS80Bgzd7rssG_aQxj3gNLZeToKTKg03AP7nnZpNxDWzSmBeZAy3LfqW70ke1ZJjf3BzgDQMaLxo77D1_ECLszl0H92Q7mGr8mE34PElJDh2YaOtTY4c9kF4tiyuJMSIXNWDOJXVWmiEfVEErUbrW8kl9UlUM-shsqzTVnXRi11LrzRMWpmWil5PvHxsPZ8fbMXnJHdCxIoaKzXmAHhq4NUHmhtMnJ6rirJUsPbsg6nj6CV_3KGC9isRI3cZ9VGw"
            />
            <div>
              <h1 className="font-bold text-base text-[#002972] leading-tight">
                UNHAS Survey
              </h1>
              <p className="text-[10px] text-[#434652] font-semibold">
                Admin Console
              </p>
            </div>
          </Link>

          {/* Mid Navigation */}
          <nav className="flex items-center gap-4 text-sm font-semibold text-[#434652]">
            <Link
              to="/admin/surveys"
              activeOptions={{ exact: false }}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
              activeProps={{
                className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
              }}
            >
              <span className="material-symbols-outlined text-lg">poll</span>
              <span>Kelola Survey</span>
            </Link>

            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
              activeProps={{
                className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
              }}
            >
              <span className="material-symbols-outlined text-lg">
                dashboard
              </span>
              <span>Dashboard</span>
            </Link>

            <Link
              to="/admin/analytics"
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
              activeProps={{
                className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
              }}
            >
              <span className="material-symbols-outlined text-lg">
                analytics
              </span>
              <span>Analytics</span>
            </Link>

            {user?.role === "admin" && (
              <Link
                to="/admin/users"
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
                activeProps={{
                  className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
                }}
              >
                <span className="material-symbols-outlined text-lg">group</span>
                <span>Kelola Pengguna</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/20 font-bold transition-all text-xs border border-transparent hover:border-[#ffdad6]"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full animate-fade-in">
        {/* Main Canvas */}
        <main className="grow py-8 px-6 md:px-10 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
