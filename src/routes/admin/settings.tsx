import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Search, UserPlus, Settings } from "lucide-react";
import { useState } from "react";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/useToast";
import {
	createUserFn,
	listUsersFn,
	toggleUserStatusFn,
	updateUserFn,
} from "../../server/adminUserFunctions";
import {
	getSurveyCategoriesFn,
	updateSurveyCategorySettingsFn,
} from "../../server/adminSurveyFunctions";

export const Route = createFileRoute("/admin/settings")({
	loader: async () => {
		const [users, categories] = await Promise.all([
			listUsersFn(),
			getSurveyCategoriesFn(),
		]);
		return { users, categories };
	},
	component: SettingsComponent,
});

function SettingsComponent() {
	const { users, categories } = Route.useLoaderData();
	const router = useRouter();

	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");

	// User Modal States
	const [isOpenAddModal, setIsOpenAddModal] = useState(false);
	const [isOpenEditModal, setIsOpenEditModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState<any>(null);

	// Category Modal States
	const [isOpenEditCategoryModal, setIsOpenEditCategoryModal] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<any>(null);

	// User Form States
	const [username, setUsername] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"admin" | "visitor">("visitor");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	// Category Form States
	const [categoryName, setCategoryName] = useState("");
	const [requirePeriod, setRequirePeriod] = useState(false);
	const [enableConditional, setEnableConditional] = useState(false);
	const [categoryLoading, setCategoryLoading] = useState(false);

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

	const handleOpenEditCategoryModal = (cat: any) => {
		setSelectedCategory(cat);
		setCategoryName(cat.name);
		setRequirePeriod(cat.requirePeriod);
		setEnableConditional(cat.enableConditional);
		setIsOpenEditCategoryModal(true);
	};

	const handleToggleStatus = async (user: any) => {
		try {
			const res = await toggleUserStatusFn({
				data: { id: user.id, isActive: !user.isActive },
			});
			if (res.success) {
				toast.success(
					`Status pengguna berhasil ${!user.isActive ? "diaktifkan" : "dinonaktifkan"}!`,
				);
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal mengubah status pengguna.");
		}
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
				await router.invalidate();
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
					passwordHash: password ? password : undefined,
				},
			});

			if (res.success) {
				toast.success("Informasi pengguna berhasil diperbarui!");
				setIsOpenEditModal(false);
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal memperbarui pengguna.");
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateCategory = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!categoryName.trim()) {
			toast.error("Nama Kategori wajib diisi.");
			return;
		}

		setCategoryLoading(true);
		try {
			const res = await updateSurveyCategorySettingsFn({
				data: {
					slug: selectedCategory.slug,
					name: categoryName.trim(),
					requirePeriod,
					enableConditional,
				},
			});

			if (res.success) {
				toast.success("Konfigurasi kategori berhasil diperbarui!");
				setIsOpenEditCategoryModal(false);
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal memperbarui kategori.");
		} finally {
			setCategoryLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center gap-4">
				<div>
					<h2 className="text-3xl font-bold text-[#4A0000]">Pengaturan</h2>
					<p className="text-sm text-[#434652] mt-1">
						Kelola pengguna sistem dan konfigurasi kategori survei Anda.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
				{/* ============================== CARD KELOLA PENGGUNA ============================== */}
				<div className="bg-white rounded-xl p-6 shadow-sm border border-[#c4c6d4] flex flex-col gap-4">
					<div className="flex justify-between items-center border-b border-slate-100 pb-3">
						<h3 className="text-lg font-bold text-[#1a1b21]">Kelola Pengguna</h3>
						<button
							onClick={handleOpenAddModal}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer"
						>
							<UserPlus className="h-3.5 w-3.5" />
							<span>Tambah User</span>
						</button>
					</div>

					{/* Filters & Tools Bar */}
					<div className="flex flex-col sm:flex-row gap-3 items-center">
						<div className="relative w-full sm:grow">
							<Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
							<input
								className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs w-full focus:border-[#4A0000] focus:ring-1 focus:outline-none"
								placeholder="Cari nama, email, username..."
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
						<select
							value={roleFilter}
							onChange={(e) => setRoleFilter(e.target.value)}
							className="border border-slate-200 rounded-lg text-xs px-3 py-1.5 focus:border-[#4A0000] focus:ring-1 outline-none text-[#434652] bg-white cursor-pointer w-full sm:w-auto"
						>
							<option value="all">Semua Peran</option>
							<option value="admin">Admin</option>
							<option value="visitor">Visitor</option>
						</select>
					</div>

					{/* Users Table */}
					<div className="overflow-x-auto border border-slate-100 rounded-lg">
						<table className="w-full text-left border-collapse text-xs">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-250 text-[#434652] font-semibold uppercase">
									<th className="py-2.5 px-4">Nama</th>
									<th className="py-2.5 px-4">Username</th>
									<th className="py-2.5 px-4">Role</th>
									<th className="py-2.5 px-4">Status</th>
									<th className="py-2.5 px-4 text-right w-16">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredUsers.map((u) => (
									<tr
										key={u.id}
										className="hover:bg-slate-50/50 transition-colors"
									>
										<td className="py-3 px-4 font-semibold text-[#1a1b21]">
											{u.name}
										</td>
										<td className="py-3 px-4 text-slate-500">{u.username}</td>
										<td className="py-3 px-4">
											<span
												className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
													u.role === "admin"
														? "bg-indigo-100 text-indigo-800"
														: "bg-teal-100 text-teal-800"
												}`}
											>
												{u.role === "admin" ? "Admin" : "Visitor"}
											</span>
										</td>
										<td className="py-3 px-4">
											<button
												onClick={() => handleToggleStatus(u)}
												className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer ${
													u.isActive
														? "bg-emerald-105 text-emerald-800 hover:bg-rose-100 hover:text-rose-800"
														: "bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-800"
												}`}
												title={
													u.isActive
														? "Klik untuk Nonaktifkan"
														: "Klik untuk Aktifkan"
												}
											>
												<span
													className={`w-1 h-1 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
												></span>
												{u.isActive ? "Aktif" : "Nonaktif"}
											</button>
										</td>
										<td className="py-3 px-4 text-right">
											<button
												onClick={() => handleOpenEditModal(u)}
												className="inline-flex p-1 rounded-lg border border-slate-200 text-[#4A0000] hover:bg-[#dbe1ff] transition-all cursor-pointer"
												title="Edit User"
											>
												<Pencil className="h-3.5 w-3.5 block" />
											</button>
										</td>
									</tr>
								))}
								{filteredUsers.length === 0 && (
									<tr>
										<td
											colSpan={5}
											className="py-6 text-center text-slate-400 italic"
										>
											Tidak ada pengguna yang ditemukan.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* ============================== CARD DAFTAR KATEGORI ============================== */}
				<div className="bg-white rounded-xl p-6 shadow-sm border border-[#c4c6d4] flex flex-col gap-4">
					<div className="flex justify-between items-center border-b border-slate-100 pb-3">
						<h3 className="text-lg font-bold text-[#1a1b21]">
							Daftar Kategori Survei
						</h3>
					</div>

					{/* Categories Table */}
					<div className="overflow-x-auto border border-slate-100 rounded-lg">
						<table className="w-full text-left border-collapse text-xs">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-250 text-[#434652] font-semibold uppercase">
									<th className="py-2.5 px-4">Kategori</th>
									<th className="py-2.5 px-4">Wajib Periode</th>
									<th className="py-2.5 px-4">Conditional Visibility</th>
									<th className="py-2.5 px-4 text-right w-16">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{categories.map((cat) => (
									<tr
										key={cat.slug}
										className="hover:bg-slate-50/50 transition-colors"
									>
										<td className="py-3 px-4">
											<div className="font-semibold text-[#1a1b21]">
												{cat.name}
											</div>
											<div className="text-[10px] text-slate-400">
												{cat.slug}
											</div>
										</td>
										<td className="py-3 px-4">
											<span
												className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
													cat.requirePeriod
														? "bg-amber-100 text-amber-800"
														: "bg-slate-100 text-slate-600"
												}`}
											>
												{cat.requirePeriod ? "Wajib" : "Tidak Wajib"}
											</span>
										</td>
										<td className="py-3 px-4">
											<span
												className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
													cat.enableConditional
														? "bg-purple-100 text-purple-800"
														: "bg-slate-100 text-slate-600"
												}`}
											>
												{cat.enableConditional ? "Aktif" : "Nonaktif"}
											</span>
										</td>
										<td className="py-3 px-4 text-right">
											<button
												onClick={() => handleOpenEditCategoryModal(cat)}
												className="inline-flex p-1 rounded-lg border border-slate-200 text-[#4A0000] hover:bg-[#dbe1ff] transition-all cursor-pointer"
												title="Edit Kategori"
											>
												<Pencil className="h-3.5 w-3.5 block" />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
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
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
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
							className="w-full bg-slate-150 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 outline-none"
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
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
						>
							{loading ? "Menyimpan..." : "Simpan Perubahan"}
						</button>
					</div>
				</form>
			</Dialog>

			{/* ============================== EDIT CATEGORY MODAL ============================== */}
			<Dialog
				isOpen={isOpenEditCategoryModal}
				onClose={() => setIsOpenEditCategoryModal(false)}
				title="Edit Pengaturan Kategori"
			>
				<form onSubmit={handleUpdateCategory} className="space-y-4">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-bold text-[#1a1b21] uppercase">
							Slug Kategori (Tidak dapat diubah)
						</label>
						<input
							type="text"
							value={selectedCategory?.slug || ""}
							disabled
							className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 outline-none"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="edit_cat_name"
							className="text-xs font-bold text-[#1a1b21] uppercase"
						>
							Nama Kategori
						</label>
						<input
							type="text"
							id="edit_cat_name"
							value={categoryName}
							onChange={(e) => setCategoryName(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
							placeholder="Nama kategori..."
							required
						/>
					</div>

					<div className="space-y-3 pt-2">
						<label className="flex items-center gap-2 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={requirePeriod}
								onChange={(e) => setRequirePeriod(e.target.checked)}
								className="rounded border-slate-300 text-[#4A0000] focus:ring-[#4A0000] cursor-pointer"
							/>
							<span className="text-xs font-bold text-[#1a1b21] uppercase">
								Wajib Isi Periode Survei
							</span>
						</label>
						<p className="text-xxs text-slate-500 pl-5">
							Jika dicentang, survei dengan kategori ini wajib diisi tanggal
							mulai dan berakhirnya sebelum disimpan atau dipublikasikan.
						</p>

						<label className="flex items-center gap-2 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={enableConditional}
								onChange={(e) => setEnableConditional(e.target.checked)}
								className="rounded border-slate-300 text-[#4A0000] focus:ring-[#4A0000] cursor-pointer"
							/>
							<span className="text-xs font-bold text-[#1a1b21] uppercase">
								Terapkan Conditional Visibility
							</span>
						</label>
						<p className="text-xxs text-slate-500 pl-5">
							Mengaktifkan opsi pencabangan alur pengisian pertanyaan di halaman
							pembuat survei dan tampilan pengisi survei publik.
						</p>
					</div>

					<div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
						<button
							type="button"
							onClick={() => setIsOpenEditCategoryModal(false)}
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={categoryLoading}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
						>
							{categoryLoading ? "Menyimpan..." : "Simpan Perubahan"}
						</button>
					</div>
				</form>
			</Dialog>
		</div>
	);
}
