import type { ServicePolicies } from "../domain/ServicePolicies.js";

export interface ServicePolicyRepository {
  findPolicies(): ServicePolicies;
}