// Compatibility exports: handler ownership is separated by audience and lifecycle.
export { getPublicProduct, getProductQr, recordScan } from './publicProducts/rendering';
export {
  listProductProfiles,
  getProfileForBatch,
  upsertProfile,
  publishProfile,
} from './publicProducts/administration';
export { listRecalls, createRecall } from './publicProducts/recalls';
