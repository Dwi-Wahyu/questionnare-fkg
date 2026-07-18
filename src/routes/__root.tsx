import { type ReactNode, useEffect, useState } from "react";
import "../styles.css";
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import { Home, LayoutDashboard, LogOut } from "lucide-react";
import { ToastContainer } from "../components/ui/Toast";
import { toast } from "../components/ui/useToast";
import { getSessionFn, logoutFn } from "../server/authFunctions";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Tracer Study & Survey FKG Unhas",
			},
		],
		links: [
			{ rel: "icon", type: "image/png", href: "/favicon.png" },
			{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
		],
	}),
	loader: async () => {
		const user = await getSessionFn();
		return { user };
	},
	component: RootComponent,
	errorComponent: ({ error }) => {
		return (
			<div
				className="storefront-container"
				style={{
					padding: "40px",
					minHeight: "100vh",
					background: "#0f172a",
					color: "#f43f5e",
				}}
			>
				<div
					className="card"
					style={{ padding: "30px", borderColor: "#f43f5e" }}
				>
					<h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>
						Terjadi Kesalahan pada Server
					</h2>
					<p className="text-secondary mt-2" style={{ fontSize: "0.9rem" }}>
						Berikut adalah detail kesalahan untuk diagnosis:
					</p>
					<pre
						style={{
							margin: "20px 0",
							padding: "16px",
							background: "rgba(0,0,0,0.3)",
							borderRadius: "8px",
							overflowX: "auto",
							fontSize: "0.85rem",
							fontFamily: "monospace",
						}}
					>
						{error instanceof Error ? error.message : String(error)}
					</pre>
					<pre
						style={{
							padding: "16px",
							background: "rgba(0,0,0,0.3)",
							borderRadius: "8px",
							overflowX: "auto",
							fontSize: "0.85rem",
							fontFamily: "monospace",
							color: "#94a3b8",
						}}
					>
						{error instanceof Error ? error.stack : ""}
					</pre>
				</div>
			</div>
		);
	},
	notFoundComponent: () => {
		return (
			<div
				className="storefront-container flex items-center justify-center"
				style={{ minHeight: "calc(100vh - 120px)" }}
			>
				<div
					className="card text-center"
					style={{ padding: "40px", maxWidth: 450 }}
				>
					<span style={{ fontSize: "3rem" }}>🔍</span>
					<h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: 16 }}>
						Halaman Tidak Ditemukan
					</h2>
					<p className="text-secondary mt-2">
						Maaf, halaman yang Anda cari tidak tersedia atau telah dihapus.
					</p>
					<Link to="/" className="btn btn-primary mt-6 w-full">
						Kembali ke Beranda
					</Link>
				</div>
			</div>
		);
	},
});

function RootComponent() {
	const { user } = Route.useLoaderData();
	const location = useLocation();
	const router = useRouter();

	const [isMounted, setIsMounted] = useState(false);
	useEffect(() => {
		setIsMounted(true);
	}, []);

	const isAdminRoute = location.pathname.startsWith("/admin");
	const isAuthRoute = location.pathname === "/login";

	const handleLogout = async () => {
		await logoutFn();
		toast.success("Anda telah keluar.");
		await router.invalidate();
		router.navigate({ to: "/login" });
	};

	return (
		<RootDocument>
			{!isAdminRoute && !isAuthRoute && (
				<header className="hidden md:block bg-surface top-0 bg-surface-container-low shadow-sm sticky z-50">
					<div className="flex justify-between items-center px-6 py-4 max-w-[1280px] mx-auto w-full">
						<Link to="/" className="flex items-center gap-3">
							<img
								src={"/logo.webp"}
								alt="Logo FKG Unhas"
								className="h-10 w-auto object-contain"
								suppressHydrationWarning
							/>
							<div className="flex flex-col">
								<span className="font-bold text-sm md:text-base text-[#4A0000] leading-tight">
									Fakultas Kedokteran Gigi
								</span>
								<span className="text-[9px] md:text-[10px] text-[#434652] font-semibold uppercase tracking-wider leading-none mt-0.5">
									Universitas Hasanuddin
								</span>
							</div>
						</Link>
						<nav className="flex items-center gap-6 text-sm font-medium">
							<Link
								to="/"
								className="text-[#4A0000] font-bold border-b-2 border-[#4A0000] py-1"
								activeProps={{ className: "active" }}
								activeOptions={{ exact: true }}
							>
								Beranda
							</Link>

							{user ? (
								<div className="flex items-center gap-4">
									{(user.role === "admin" || user.role === "visitor") && (
										<Link
											to="/admin"
											className="bg-[#eeedf6] text-[#4A0000] hover:bg-[#e2e2ea] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
										>
											<LayoutDashboard size={16} />
											<span>Admin Panel</span>
										</Link>
									)}
									<span className="text-[#434652]">
										Halo, <strong>{user.username}</strong>
									</span>
									<button
										type="button"
										className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
										onClick={handleLogout}
									>
										<LogOut size={16} />
										<span>Keluar</span>
									</button>
								</div>
							) : (
								<Link
									to="/login"
									className="bg-[#4A0000] text-white hover:bg-[#B00000] px-5 py-2 rounded-lg font-medium transition-colors"
								>
									Masuk
								</Link>
							)}
						</nav>
					</div>
				</header>
			)}

			<main
				className={isAdminRoute ? "" : "grow flex flex-col"}
				style={isAdminRoute ? {} : { minHeight: "calc(100vh - 80px)" }}
			>
				<Outlet />
			</main>

			<ToastContainer />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="id">
			<head>
				<HeadContent />
				<link
					href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap"
					rel="stylesheet"
				/>

			</head>
			<body className="min-h-screen flex flex-col font-sans text-on-surface bg-background">
				{children}
				<script
					dangerouslySetInnerHTML={{
						__html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister();
                  }
                });
              }
            `,
					}}
				/>
				<Scripts />
			</body>
		</html>
	);
}
