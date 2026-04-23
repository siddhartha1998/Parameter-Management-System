# 💠 TMS Parameter Management System

A high-performance, hierarchical configuration management system designed for terminal hardware and complex multi-tenant environments. This platform allows administrators to design intricate parameter structures (Templates) and apply context-specific overrides for individual terminals or resources.

---

## 🚀 System Flow

The application follows a structured "Design-to-Deployment" lifecycle:

1.  **Template Design (Admin Mode)**:
    *   Create or import JSON structures to define the hierarchy.
    *   Define metadata: Data Types, Validation Rules, Display Labels, and JSON Keys.
    *   Set system-wide `Default Values`.
2.  **Parameter Overrides (Terminal Mode)**:
    *   Select a specific terminal or resource.
    *   The system loads the "Effective Configuration" based on the current Template.
    *   Administrators can selectively override any parameter value. Un-overridden values fall back to the Template defaults.
3.  **Real-Time JSON Reconstruction**:
    *   The "Sync Engine" constantly recalculates the final JSON payload in memory.
    *   Provides instant feedback in the "Preview JSON" tab.
4.  **Deployment**:
    *   The final, reconstructed JSON is persisted and served to hardware via secure APIs.

---

## 🎨 Design Rules & UI/UX Standards

The dashboard adheres to a **Premium, Dark-Cored aesthetic** optimized for efficiency:

### 1. Layout Standards
*   **Tree Navigation (Left)**: A folder-based explorer showing the logical hierarchy. High-level nodes (Objects/ObjectArrays) act as containers.
*   **Workspace Grid (Center)**: Minimalist cards representing parameters. Cards are context-aware (e.g., Booleans show dropdowns, StringArrays show tag-pills).
*   **Properties Sidebar (Right)**: Dense, grouping-free property grid for rapid metadata editing. Auto-populates `snake_case` keys from human-readable labels.

### 2. Interaction Guidelines
*   **Modal Overlays**: Complex data entry (like String Arrays) occurs in a modal with a concentrated light backdrop (0.7 opacity) to focus user attention and prevent background interference.
*   **Real-time Synchronization**: All tabs share a single source of truth (Angular Signals), ensuring no data is lost when toggling between Design, Edit, and Preview modes.
*   **Aggressive Feedback**: Inline validation warnings trigger instantly for mandatory fields, max-lengths, and custom regex rules.

---

## 🧠 Business Logic

### Hierarchical Inheritance
*   **Deep Nesting**: Supports infinite nesting using a `ParentPath` and `KeyName` relationship.
*   **Cascading Overrides**: Terminal-specific values have the highest priority. If an override is removed, the system transparently falls back to the parent Template's default value.

### Complex Data Types
*   **ObjectArray**: A specialized folder that allows multiple "instances" of its children (perfect for repeated configurations like multiple Network Priorities or Acquisition Hosts).
*   **StringArray**: Managed as tag collections, allowing easy multi-selection and ordering.
*   **Validation Rules**: Built-in support for Phone, Email, Website URL, and Custom Regular Expressions.

### Versioning & Lifecycle
*   **Draft (0)**: Editable templates for active design.
*   **Published (1)**: Live templates. These cannot be edited directly; they must be cloned into a new Draft to ensure terminal stability.

---

## 🛠 Technical Documentation

### Tech Stack
*   **Frontend**: Angular 19+ (Signals-based state management).
*   **Backend**: .NET 9+ Web API with EF Core.
*   **Database**: PostgreSQL / SQL Server (Hierarchical self-referencing models).
*   **Styling**: Vanilla CSS with modern Flexbox and Grid layouts.

### Core Architecture (Frontend)
*   **`DesignerService`**: The engine of the application. It maintains the `definitions` signal and handles recursive JSON reconstruction in the browser for zero-latency previews.
*   **Data Context Mode**: The system tracks whether it is in `template` or `overrides` mode to intelligently manage API calls and local state preservation.
*   **Recursive Components**: Tree structures and breadcrumbs are rendered recursively based on the `currentPath` state.

### Backend Integration
*   **Bulk API Operations**: Supports sending entire template payloads in a single transaction to minimize latency and ensure data integrity.
*   **Recursive Database Queries**: Fetching a deep hierarchy is optimized via path-based lookups and efficient SQL joins.

---

## 📂 Project Structure

```text
src/
├── client/                     # Angular Application
│   ├── app/
│   │   ├── components/        # UI Dashboard & Modal Logic
│   │   ├── services/          # State Engine & API Wrappers
│   │   ├── models/            # Shared interfaces & Enums
│   │   └── app.css            # Global Design System
├── ParameterManager.Api/       # .NET Web API Controllers
├── ParameterManager.Core/      # Business Entities & JSON logic
└── ParameterManager.Data/      # DB Context & Repository Layer
```

---

*Designed and Maintained for High-Precision Configuration Management.*
