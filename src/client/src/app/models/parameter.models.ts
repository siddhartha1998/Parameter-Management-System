export enum DataType {
  Boolean = 0,
  Integer = 1,
  String = 2,
  StringArray = 3,
  ObjectArray = 4,
  Object = 5,
  HexString = 6,
  Source = 7
}

export enum ScopeLevel {
  Global = 0,
  Merchant = 1,
  Outlet = 2,
  Terminal = 3
}

export enum ParamCategory {
  Configuration = 0,
  Transaction = 1
}

export interface ParameterDefinition {
  id?: string;
  resourceId?: string;
  parameterTemplateId?: string;
  keyName: string;
  label: string;
  parentId?: string;
  parentPath: string;
  paramCategory: ParamCategory;
  dataType: DataType;
  scopeLevel: ScopeLevel;
  validationRule?: string;
  maxLength?: number;
  displayOrder: number;
  description?: string;
  dataSource?: string;
  isActive: boolean;
  isDepreciated: boolean;
  isMandatory: boolean;
  defaultValues: string[];
  parameterValueIds?: string[];
  baseParameterValueIds?: string[];
  baseTemplateValues?: string[];
}

export interface OverrideRequest {
  parameterValueId: string;
  overrideValue: string;
  isActive: boolean;
  node: ScopeLevel;
  nodeId: string;
}

export interface ParameterTemplate {
  parameterTemplateId: string;
  resourceId?: string;
  templateName: string;
  status: number;
  version: number;
}

export interface TemplateDesign {
  resourceId?: string;
  parameterTemplateId?: string;
  templateName: string;
  status: number;
  version: number;
  category: number;
  definitions: ParameterDefinition[];
}
