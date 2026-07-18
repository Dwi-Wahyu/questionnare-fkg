import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/useToast";
import {
	createUserFn,
	listUsersFn,
	toggleUserStatusFn,
	updateUserFn,
} from "../../server/adminUserFunctions";
import { UserPlus, Search, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
	loader: async () => {
		return await listUsersFn();
	},
	component: UserManagementComponent,
});

function UserManagementComponent() {
	const users = Route.useLoaderData();
	const router = Route.useRouteContext();

	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");

	// Modal States
	const [isOpenAddModal, setIsOpenAddModal] = useState(false);
	const [isOpenEditModal, setIsOpenEditModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState<any>(null);

	// Form States
	const [username, setUsername] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"admin" | "visitor">("visitor");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	// Filter users
	const filteredUsers = users.filter((u) => {
		const matchesSearch =
			u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
		const matchesRole = roleFilter === "all" || u.role === roleFilter;
		return matchesSearch && matchesRole;
	});

	const handleOpenAddModal = () => {
		setUsername("");
		setName("");
		setEmail("");
		setRole("visitor");
		setPassword("");
		setIsOpenAddModal(true);
	};

	const handleOpenEditModal = (user: any) => {
		setSelectedUser(user);
		setName(user.name);
		setEmail(user.email || "");
		setRole(user.role);
		setPassword(""); // leave blank unless changing
		setIsOpenEditModal(true);
	};

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !name.trim() || !password.trim()) {
			toast.error("Username, Nama Lengkap, dan Password wajib diisi.");
			return;
		}

		setLoading(true);
		try {
			const res = await createUserFn({
				data: {
					username: username.trim(),
					name: name.trim(),
					email: email.trim() || undefined,
					role,
					passwordHash: password,
				},
			});

			if (res.success) {
				toast.success("User baru berhasil ditambahkan!");
				setIsOpenAddModal(false);
				window.location.reload(); // force full reload of loaders
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal membuat user baru.");
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Nama Lengkap wajib diisi.");
			return;
		}

		setLoading(true);
		try {
			const res = await updateUserFn({
				data: {
					id: selectedUser.id,
					name: name.trim(),
					email: email.trim() || undefined,
					role,
					password: password.trim() !== "" ? password : undefined,
				},
			});

			if (res.success) {
				toast.success("User berhasil diperbarui!");
				setIsOpenEditModal(false);
				window.location.reload();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal memperbarui user.");
		} finally {
			setLoading(false);
		}
	};

	const handleToggleStatus = async (user: any) => {
		try {
			const nextStatus = !user.isActive;
			const res = await toggleUserStatusFn({
				data: {
					id: user.id,
					isActive: nextStatus,
				},
			});

			if (res.success) {
				toast.success(
					`User "${user.name}" berhasil ${nextStatus ? "diaktifkan" : "dinonaktifkan"}`,
				);
				window.location.reload();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal mengubah status user.");
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center gap-4">
				<div>
					<h2 className="text-3xl font-bold text-[#4A0000]">Kelola Pengguna</h2>
					<p className="text-sm text-[#434652] mt-1">
						Kelola akun admin dan visitor serta kontrol akses ke modul survei.
					</p>
				</div>
				<button
					onClick={handleOpenAddModal}
					className="bg-[#4A0000] text-white md:h-fit md:w-fit hover:bg-[#B00000] text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
				>
					<UserPlus className="h-4 w-4" />
					<span>Tambah Pengguna Baru</span>
				</button>
			</div>

			{/* Filters & Tools Bar */}
			<div className="bg-white rounded-xl p-4 shadow-sm border border-[#c4c6d4] flex flex-col md:flex-row justify-between items-center gap-4">
				<div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
					<div className="relative w-full md:w-64">
						<Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
						<input
							className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs w-full focus:border-[#4A0000] focus:ring-1 focus:outline-none"
							placeholder="Cari berdasarkan nama, email, username..."
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<select
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
						className="border border-slate-200 rounded-lg text-xs px-3 py-1.5 focus:border-[#4A0000] focus:ring-1 outline-none text-[#434652] bg-white cursor-pointer w-full md:w-auto"
					>
						<option value="all">Semua Peran</option>
						<option value="admin">Administrator</option>
						<option value="visitor">Visitor (Hanya Lihat)</option>
					</select>
				</div>
			</div>

			{/* Users Table */}
			<div className="bg-white rounded-xl shadow-sm border border-[#c4c6d4] overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse text-sm">
						<thead>
							<tr className="bg-slate-50 border-b border-[#c4c6d4] text-[#434652] font-semibold text-xs uppercase">
								<th className="py-3 px-6">Nama Pengguna</th>
								<th className="py-3 px-6">Username</th>
								<th className="py-3 px-6">Role / Peran</th>
								<th className="py-3 px-6">Email</th>
								<th className="py-3 px-6">Status</th>
								<th className="py-3 px-6 text-right w-32">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{filteredUsers.map((u) => (
								<tr
									key={u.id}
									className="hover:bg-slate-50/50 transition-colors"
								>
									<td className="py-4 px-6 font-semibold text-[#1a1b21]">
										{u.name}
									</td>
									<td className="py-4 px-6 text-slate-500">{u.username}</td>
									<td className="py-4 px-6">
										<span
											className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
												u.role === "admin"
													? "bg-indigo-100 text-indigo-850"
													: "bg-teal-100 text-teal-800"
											}`}
										>
											{u.role === "admin" ? "Admin" : "Visitor"}
										</span>
									</td>
									<td className="py-4 px-6 text-slate-500">{u.email || "-"}</td>
									<td className="py-4 px-6">
										<button
											onClick={() => handleToggleStatus(u)}
											className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
												u.isActive
													? "bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800"
													: "bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-800"
											}`}
											title={
												u.isActive
													? "Klik untuk Nonaktifkan"
													: "Klik untuk Aktifkan"
											}
										>
											<span
												className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
											></span>
											{u.isActive ? "Aktif" : "Nonaktif"}
										</button>
									</td>
									<td className="py-4 px-6 text-right">
										<button
											onClick={() => handleOpenEditModal(u)}
											className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#4A0000] hover:bg-[#dbe1ff] transition-all"
											title="Edit User"
										>
											<Pencil className="h-4 w-4 block" />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* ============================== ADD USER MODAL ============================== */}
			<Dialog
				isOpen={isOpenAddModal}
				onClose={() => setIsOpenAddModal(false)}
				title="Tambah Pengguna Baru"
			>
				<form onSubmit={handleCreateUser} className="space-y-4">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="add_username"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Username
						</label>
						<input
							type="text"
							id="add_username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Masukkan username unik..."
							required
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="add_name"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Nama Lengkap
						</label>
						<input
							type="text"
							id="add_name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Nama lengkap beserta gelar..."
							required
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="add_email"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Email (Opsional)
						</label>
						<input
							type="email"
							id="add_email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="contoh@domain.com"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="add_role"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Peran / Akses
						</label>
						<select
							id="add_role"
							value={role}
							onChange={(e) => setRole(e.target.value as any)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none cursor-pointer"
						>
							<option value="visitor">Visitor (Lihat &amp; Ekspor saja)</option>
							<option value="admin">Administrator (Akses Penuh)</option>
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="add_pw"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Kata Sandi
						</label>
						<input
							type="password"
							id="add_pw"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Masukkan kata sandi..."
							required
						/>
					</div>

					<div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
						<button
							type="button"
							onClick={() => setIsOpenAddModal(false)}
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] px-4 py-2 rounded-lg text-xs font-semibold"
						>
							{loading ? "Menyimpan..." : "Simpan Pengguna"}
						</button>
					</div>
				</form>
			</Dialog>

			{/* ============================== EDIT USER MODAL ============================== */}
			<Dialog
				isOpen={isOpenEditModal}
				onClose={() => setIsOpenEditModal(false)}
				title="Edit Pengguna"
			>
				<form onSubmit={handleUpdateUser} className="space-y-4">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-bold text-[#1a1b21] uppercase">
							Username (Tidak dapat diubah)
						</label>
						<input
							type="text"
							value={selectedUser?.username || ""}
							disabled
							className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 outline-none"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="edit_name"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Nama Lengkap
						</label>
						<input
							type="text"
							id="edit_name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Nama lengkap..."
							required
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="edit_email"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Email (Opsional)
						</label>
						<input
							type="email"
							id="edit_email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="contoh@domain.com"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="edit_role"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Peran / Akses
						</label>
						<select
							id="edit_role"
							value={role}
							onChange={(e) => setRole(e.target.value as any)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none cursor-pointer"
						>
							<option value="visitor">Visitor (Lihat &amp; Ekspor saja)</option>
							<option value="admin">Administrator (Akses Penuh)</option>
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="edit_pw"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Ubah Kata Sandi (Kosongkan jika tidak diubah)
						</label>
						<input
							type="password"
							id="edit_pw"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Masukkan kata sandi baru..."
						/>
					</div>

					<div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
						<button
							type="button"
							onClick={() => setIsOpenEditModal(false)}
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] px-4 py-2 rounded-lg text-xs font-semibold"
						>
							{loading ? "Menyimpan..." : "Simpan Perubahan"}
						</button>
					</div>
				</form>
			</Dialog>
		</div>
	);
}
