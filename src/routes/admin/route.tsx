import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { ChartBar, LayoutDashboard, LogOut, Settings } from "lucide-react";
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
			<header className="bg-white border-b border-[#c4c6d4] sticky top-0 left-0 right-0 flex justify-between items-center h-16 px-4 md:px-6 z-30 shadow-sm w-full">
				<div className="flex items-center gap-4 md:gap-8 overflow-hidden grow">
					<Link
						to="/admin/surveys"
						className="flex items-center gap-2.5 md:gap-3 shrink-0"
					>
						<img
							alt="Universitas Hasanuddin Logo"
							className="h-8 md:h-9 w-auto object-contain"
							src={"/logo.webp"}
						/>
						<div>
							<h1 className="font-bold text-sm md:text-base text-[#4A0000] leading-tight">
								UNHAS Survey
							</h1>
							<p className="text-[9px] md:text-[10px] text-[#434652] font-semibold">
								Admin Console
							</p>
						</div>
					</Link>

					{/* Mid Navigation */}
					<nav className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-semibold text-[#434652] overflow-x-auto max-w-[calc(100vw-180px)] md:max-w-none whitespace-nowrap scrollbar-none pb-1 md:pb-0">
						<Link
							to="/admin/surveys"
							activeOptions={{ exact: false }}
							className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
							activeProps={{
								className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
							}}
						>
							<ChartBar className="h-[18px] w-[18px]" />
							<span>
								{user?.role === "visitor" ? "Daftar Survey" : "Kelola Survey"}
							</span>
						</Link>

						{user?.role === "admin" && (
							<Link
								to="/admin"
								activeOptions={{ exact: true }}
								className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
								activeProps={{
									className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
								}}
							>
								<LayoutDashboard className="h-[18px] w-[18px]" />
								<span>Dashboard</span>
							</Link>
						)}

						{/* <Link
              to="/admin/analytics"
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
              activeProps={{
                className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
              }}
            >
              <ChartColumn className="h-[18px] w-[18px]" />
              <span>Analytics</span>
            </Link> */}

						{user?.role === "admin" && (
							<Link
								to="/admin/settings"
								className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-[#eeedf6] transition-colors"
								activeProps={{
									className: "bg-[#dbe1ff] text-[#0f409e] font-bold",
								}}
							>
								<Settings className="h-[18px] w-[18px]" />
								<span>Pengaturan</span>
							</Link>
						)}
					</nav>
				</div>

				<div className="flex items-center gap-2 md:gap-6 shrink-0">
					<button
						type="button"
						className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/20 font-bold transition-all text-xs border border-transparent hover:border-[#ffdad6]"
						onClick={handleLogout}
					>
						<LogOut className="h-[18px] w-[18px]" />
						<span className="hidden sm:inline">Logout</span>
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
