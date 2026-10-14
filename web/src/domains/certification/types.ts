export interface Certificate {
  id: string;
  farm_id: string;
  farmer_organization_id: string;
  certifier_organization_id: string;
  certifier_name?: string;
  standard: string;
  crop_scope: string[];
  valid_from: string;
  valid_to: string;
  status: string;
  issuing_authority?: string;
  accreditation_reference?: string;
}
