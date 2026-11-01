/**
 * Fragmen SQL: baris hanya dihitung bila dataset asalnya aktif (atau tidak punya dataset).
 * `alias` harus tabel yang memiliki kolom id_dataset.
 */
const active = (alias) =>
  `(${alias}.id_dataset IS NULL OR EXISTS (SELECT 1 FROM dataset_metadata dm WHERE dm.id_dataset = ${alias}.id_dataset AND dm.aktif IS NOT FALSE))`;

module.exports = { active };
