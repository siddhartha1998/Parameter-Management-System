# Parameter Configuration Management Architecture

## Goal Description
The objective is to implement a robust parameter design system capable of managing complex, hierarchical configurations across different resources, and dynamically generating the requested JSON structure for terminal downloads. The solution must support multi-level overrides (Global -> Merchant -> Outlet -> Terminal) and an intuitive UI for both defining the schema and overriding values.

## Proposed Strategy

The solution breaks down into three key pillars:
1. **Dynamic Schema Definition (`ParameterDefinition`)**: Defines the "shape" of the configuration (e.g., Object, Array, Boolean, HexString).
2. **Value Storage & Resolution (`ParameterValue`, `ParameterValueOverride`)**: Stores default values and entity-specific overrides.
3. **Reconstruction Engine**: Traverses definitions and values to build the exact nested JSON structure.

---

### 1. Database Side (Storage Design)

To handle the highly nested JSON, we treat the parameters as a Tree structure where every key maps to a predefined schema.

#### Database Entities

1. **`ParameterDefinition`** (The Schema):
   - `ParentPath`: Indicates tree placement (e.g., `""` for root, `"Paypass.Paypass_acq_A0000000041010"` for deep nesting).
   - `KeyName`: The exact JSON key (e.g., `SaleEnabled`).
   - `DataType`: The data shape. Extended to include: `Boolean`, `Integer`, `String`, `StringArray`, `ObjectArray`, `Object`, `HexString`.
   - `ScopeLevel`: Specifies minimum scope (e.g., `Terminal`, `Merchant`).

2. **`ParameterValue`** (The Defaults):
   - Stores the template's default value for a definition.
   - `InstanceIndex`: Used to group arrays (e.g., to link the first `ip`, `port`, and `priority` together as Object #0).

3. **`ParameterValueOverride`** (The Overrides):
   - Points to a `ParameterValue`.
   - `Node` (Type) & `NodeId`: Identifies the exact Merchant, Outlet, or Terminal overriding the value.

#### Mapping the User's JSON to Database

| JSON Field | ParentPath in DB | KeyName | DataType | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `SaleEnabled` | `""` (Root) | `SaleEnabled` | `Boolean` | |
| `IpAddress` | `""` | `IpAddress` | `ObjectArray` | Container. Value is empty |
| `IpAddress[0].ip` | `"IpAddress"` | `ip` | `String` | `InstanceIndex: 0` |
| `IpAddress[1].ip` | `"IpAddress"` | `ip` | `String` | `InstanceIndex: 1` |
| `Aid` | `""` | `Aid` | `StringArray` | Array of primitives |
| `Aid[0]` | `""` | `Aid` | `StringArray` | `Value: "A01", InstanceIndex: 0` |
| `MerchantInfo` | `""` | `MerchantInfo` | `Object` | Container |
| `MerchantInfo.Name`| `"MerchantInfo"` | `Name` | `String` | |
| `Paypass` | `""` | `Paypass` | `Object` | Base Container |
| `Paypass_acq...` | `"Paypass"` | `Paypass_acq_...` | `Object` | Nested Container |
| `transaction_type` | `"Paypass.Paypass_acq_..."` | `transaction_type_9C` | `HexString` | EMV Config Value |

---

### 2. UI Side Design

Effective parameter management requires splitting the UI into two distinct workspaces:

#### Workspace A: Template Designer (Admin/Developer)
**Goal:** Define the schema (Blueprint) for a Resource.
* **Component Type:** Hierarchical Tree Editor.
* **Features:**
  * **Visual Tree:** Admins see a collapsible tree map mirroring the JSON structure.
  * **Add Node:** Add basic parameters (`String`, `Integer`) or containers (`Object`, `ObjectArray`).
  * **JSON Importer:** A critical feature. An admin can paste the sample JSON provided in your prompt, and the UI automatically flattens it and generates the necessary `ParameterDefinition` tree and default `ParameterValue`s.

#### Workspace B: Scope Configuration Manager (Operator/Merchant)
**Goal:** Assign values and overrides to specific Terminals/Merchants.
* **Component Type:** Context-Aware Form Editor.
* **Features:**
  * **Scope Selector:** Choose context (e.g., "Editing configuration for Terminal T-01").
  * **Dynamic Form Rendering:** The UI reads the `ParameterDefinition` tree.
    * `Boolean` renders as Togggles.
    * `ObjectArray` (`IpAddress`) renders as an Add/Remove list of sub-forms.
    * `StringArray` (`Aid`) renders as tag chips.
  * **Inheritance Visualizer:** Shows if a value is implicitly inherited (e.g., from Merchant) or explicitly overridden at the Terminal level (bold/highlighted).

---

### 3. JSON Compilation Engine (Backend)

When a terminal requests a download, the backend resolves the payload:
1. Identify the assigned parameter `Template`.
2. Load all `ParameterDefinitions` connected to the template, ordered by `ParentPath`.
3. Load `ParameterValueOverrides` matching the terminal's hierarchy (`Template -> Merchant -> Outlet -> Terminal`) -> **"Most Specific Wins" rule.**
4. Using a recursive builder (like `System.Text.Json.Nodes.JsonObject`):
   * Iterate through definitions and place them exactly at `ParentPath`.
   * For `ObjectArray`, group values by `InstanceIndex` into arrays of objects.
   * Serialize and return.

### 4. API JSON Payloads (Frontend to Backend)

#### Scenario 1: Designing the Template (Admin)
When the admin designs the template for the first time, the frontend sends the tree structure as a flat list of definitions along with their default values.
To handle dynamic database lookups (like **AIDs** and **CAPKs**), we repurpose the `ValidationRule` field in `ParameterDefinition` as a UI directive (e.g., `@DataSource:api/paymentconfig/aids`). 

*When the frontend encounters this directive, it renders a Select/Dropdown utilizing the provided API endpoint instead of a free-text input.*

```json
{
  "resourceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "templateName": "Default Config v1",
  "definitions": [
    {
      "keyName": "SaleEnabled",
      "parentPath": "",
      "dataType": "Boolean",
      "defaultValues": ["true"] // Array to support multiple instances (InstanceIndex)
    },
    {
      "keyName": "Aid",
      "parentPath": "",
      "dataType": "StringArray",
      "validationRule": "@DataSource:api/paymentconfig/aids", 
      "defaultValues": ["A01", "A02", "A03"]
    },
    // The explicit "Paypass" Object container has been omitted.
    {
      "keyName": "transaction_type_9C",
      "parentPath": "Paypass.Paypass_acq_A0000000041010", // Backend automatically infers and creates the parent folders!
      "dataType": "HexString",
      "defaultValues": ["00"]
    }
  ]
}
```
* **Database Action:** The backend iterates through `definitions`. It parses the `parentPath` string (e.g., splitting by `.`) and **automatically creates** any missing `ParameterDefinition` rows of type `Object` for the intermediate nodes (like `Paypass`). It then creates the leaf definitions and their `defaultValues` assignments.

#### Scenario 2: Updating Existing Values (Scope Configuration)
When updating values for a specific Merchant or Terminal, the frontend only sends the values that have explicitly changed (overridden). 
As you correctly noted, we target the specific `ParameterValueId` instead of the Definition + Index. This is much cleaner and maps directly to the `ParameterValueOverride` table!

Additionally, to handle scenarios where a particular Terminal **does not need** an array item or object (e.g., omitting "A03"), the frontend passes `isActive: false` for that specific override.

```json
{
  "templateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "node": "Terminal", // "Global", "Merchant", "Outlet", "Terminal"
  "nodeId": "12345678-1234-1234-1234-1234567890ab", // Terminal ID
  "overrides": [
    {
      "parameterValueId": "uuid-for-VoidEnabled-value", // Targets the specific ParameterValue
      "overrideValue": "true",
      "isActive": true
    },
    {
      "parameterValueId": "uuid-for-Aid-A03-value", 
      "overrideValue": "A03", // or empty, since it's being disabled
      "isActive": false       // IMPORTANT: This tells the backend to EXCLUDE this item for this terminal!
    }
  ]
}
```
* **Database Action:** The backend Upserts a `ParameterValueOverride` using `ParameterValueId`.
* **JSON Reconstructor Action:** When building the final JSON for the terminal, the algorithm checks `IsActive` on the override. If it is `false`, that specific node/array item is completely skipped and not rendered in the final JSON string.

## Open Questions
> [!IMPORTANT]
> - Do you want a sample implementation of the `ParameterJsonBuilder` (the reconstructor logic) written in C#? 
> - Should I provide some UI component scaffolding (e.g., React/Angular/Blazor) indicating how the Schema Builder can be structured, or is this completely UI-agnostic at the moment?
> - Let me know if you would like me to generate a concrete image mockup of the parameter UI!

## Verification Plan
1. Validate the `DataType` enum has enough types to represent the JSON.
2. Draft the C# algorithm responsible for flattening/unflattening the database entities into the required terminal JSON.
