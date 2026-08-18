import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { formatCad } from "../../lib/money";

export type CatalogTableRow = {
	id: string;
	name: string;
	category: string;
	kind: "item" | "option";
	sku: string;
	deliveryCents: number | null;
	takeoutCents: number | null;
	isActive: boolean;
};

function option(value: string, label: string) {
	return (
		<span key={value} {...{ value }}>
			{label}
		</span>
	);
}

const columns: ColumnDef<CatalogTableRow>[] = [
	{
		accessorKey: "name",
		header: "Nom",
		cell: (info) => (
			<span className="font-medium">{String(info.getValue() ?? "")}</span>
		),
	},
	{
		accessorKey: "category",
		header: "Catégorie",
		filterFn: "equalsString",
	},
	{
		accessorKey: "kind",
		header: "Type",
		filterFn: "equalsString",
		cell: (info) =>
			info.getValue() === "option" ? (
				<Chip size="small" label="Option" color="secondary" />
			) : (
				<Chip size="small" label="Article" color="primary" />
			),
	},
	{
		accessorKey: "sku",
		header: "ID POS",
		cell: (info) => (
			<code className="text-xs">{String(info.getValue() || "—")}</code>
		),
	},
	{
		id: "delivery",
		header: "Livraison",
		accessorFn: (row) => row.deliveryCents,
		cell: (info) => {
			const value = info.getValue() as number | null;
			return value == null ? "—" : formatCad(value);
		},
	},
	{
		id: "takeout",
		header: "Emporter",
		accessorFn: (row) => row.takeoutCents,
		cell: (info) => {
			const value = info.getValue() as number | null;
			return value == null ? "—" : formatCad(value);
		},
	},
	{
		accessorKey: "isActive",
		header: "Statut",
		filterFn: (row, _id, filterValue) => {
			if (filterValue === "all" || filterValue == null || filterValue === "") {
				return true;
			}
			return filterValue === "active" ? row.original.isActive : !row.original.isActive;
		},
		cell: (info) =>
			info.getValue() ? (
				<Chip size="small" label="Actif" color="primary" />
			) : (
				<Chip size="small" label="Archivé" color="secondary" />
			),
	},
];

export function CatalogTable({
	rows,
	categories,
}: {
	rows: CatalogTableRow[];
	categories: string[];
}) {
	const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const data = useMemo(() => rows, [rows]);

	const table = useReactTable({
		data,
		columns,
		state: { sorting, columnFilters, globalFilter },
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 25 } },
	});

	const categoryFilter =
		(table.getColumn("category")?.getFilterValue() as string | undefined) ?? "all";
	const kindFilter =
		(table.getColumn("kind")?.getFilterValue() as string | undefined) ?? "all";
	const statusFilter =
		(table.getColumn("isActive")?.getFilterValue() as string | undefined) ?? "all";

	const filtered = table.getFilteredRowModel().rows.length;
	const pageIndex = table.getState().pagination.pageIndex;
	const pageCount = Math.max(1, table.getPageCount());

	return (
		<Stack spacing={2}>
			<div className="grid gap-3 md:grid-cols-4">
				<TextField
					name="catalog-search"
					label="Recherche"
					value={globalFilter}
					placeholder="Nom ou id POS"
					onChange={(event) =>
						setGlobalFilter((event.target as HTMLInputElement).value)
					}
				/>
				<Select
					name="catalog-category"
					label="Catégorie"
					value={categoryFilter}
					onSelect={(value) => {
						table
							.getColumn("category")
							?.setFilterValue(value === "all" ? undefined : String(value));
					}}
				>
					<>
						{option("all", "Toutes")}
						{categories.map((name) => option(name, name))}
					</>
				</Select>
				<Select
					name="catalog-kind"
					label="Type"
					value={kindFilter}
					onSelect={(value) => {
						table
							.getColumn("kind")
							?.setFilterValue(value === "all" ? undefined : String(value));
					}}
				>
					<>
						{option("all", "Tous")}
						{option("item", "Articles")}
						{option("option", "Options")}
					</>
				</Select>
				<Select
					name="catalog-status"
					label="Statut"
					value={statusFilter}
					onSelect={(value) => {
						table
							.getColumn("isActive")
							?.setFilterValue(value === "all" ? undefined : String(value));
					}}
				>
					<>
						{option("all", "Tous")}
						{option("active", "Actifs")}
						{option("archived", "Archivés")}
					</>
				</Select>
			</div>
			<Typography variant="caption" color="secondary">
				{filtered} article{filtered > 1 ? "s" : ""}
			</Typography>
			<Paper variant="outlined" className="overflow-x-auto">
				<table className="w-full min-w-[52rem] border-collapse text-left text-sm">
					<thead>
						{table.getHeaderGroups().map((group) => (
							<tr key={group.id} className="border-b theme-border">
								{group.headers.map((header) => {
									const sorted = header.column.getIsSorted();
									return (
										<th key={header.id} className="px-3 py-2 font-medium">
											{header.isPlaceholder ? null : (
												<button
													type="button"
													className="inline-flex items-center gap-1 bg-transparent p-0"
													onClick={header.column.getToggleSortingHandler()}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{sorted === "asc"
														? " ↑"
														: sorted === "desc"
															? " ↓"
															: ""}
												</button>
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="border-b theme-border">
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-3 py-2 align-middle">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
						{table.getRowModel().rows.length === 0 ? (
							<tr>
								<td className="px-3 py-6" colSpan={columns.length}>
									<Typography color="secondary">
										Aucun article. Synchronise le menu POS.
									</Typography>
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</Paper>
			<Stack
				direction="row"
				justifyContent="space-between"
				alignItems="center"
				flexWrap="wrap"
				useFlexGap
				spacing={1}
			>
				<Select
					name="catalog-page-size"
					label="Par page"
					value={String(table.getState().pagination.pageSize)}
					onSelect={(value) => {
						table.setPageSize(Number(value));
					}}
				>
					<>
						{option("25", "25")}
						{option("50", "50")}
						{option("100", "100")}
					</>
				</Select>
				<Stack direction="row" alignItems="center" spacing={1}>
					<Typography variant="body2">
						Page {pageIndex + 1} / {pageCount}
					</Typography>
					<Button
						size="small"
						variant="outlined"
						disabled={!table.getCanPreviousPage()}
						onClick={() => table.previousPage()}
					>
						Précédent
					</Button>
					<Button
						size="small"
						variant="outlined"
						disabled={!table.getCanNextPage()}
						onClick={() => table.nextPage()}
					>
						Suivant
					</Button>
				</Stack>
			</Stack>
		</Stack>
	);
}
