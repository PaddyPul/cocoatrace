export interface Evidence {
  id: string;
  file_name: string;
  type: string;
  sha256_hash: string;
  linked_entity_type: string;
  linked_entity_id: string;
  review_status: string;
  file_size_bytes?: number;
  mime_type?: string;
  detected_mime_type?: string;
  validation_status?: string;
  malware_scan_status?: 'legacy_unscanned' | 'clean' | 'infected' | 'scan_failed';
  malware_scanner_engine?: string;
  malware_scanned_at?: string;
  created_at: string;
}
