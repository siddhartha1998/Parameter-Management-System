import { Injectable, signal, computed, inject } from '@angular/core';
import { ParameterService } from './parameter.service';
import { ParameterDefinition, ScopeLevel, DataType, ParamCategory, OverrideRequest, ParameterTemplate } from '../models/parameter.models';

@Injectable({
  providedIn: 'root'
})
export class DesignerService {
  private paramService = inject(ParameterService);

  // --- Core State ---
  definitions = signal<ParameterDefinition[]>([]);
  activeTab = signal<'design' | 'edit' | 'preview'>('design');
  selectedTemplateId = signal<string | null>(null);
  templates = signal<ParameterTemplate[]>([]);
  selectedResourceId = signal<string | null>(null);
  isDashboardOpen = signal<boolean>(false);
  dashboardCategory = signal<'Simple' | 'Design'>('Design');
  tempTemplateName = signal<string>('');
  currentPath = signal<string[]>([]);
  selectedDefinition = signal<ParameterDefinition | null>(null);
  isSidebarOpen = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);
  deletedIds = new Set<string>();
  originalStateSnapshot = signal<string>('');
  currentArrayIndex = signal<number>(0);
  previewScope = signal<ScopeLevel>(ScopeLevel.Terminal);
  previewNodeId = signal<string>('12345678-1234-1234-1234-1234567890ab');
  reconstructedJson = signal<any>(null);
  uiRuleType = signal<string>('None');
  isStringArrayDropdownOpen = signal<string | null>(null);
  editingTagIndex = signal<{defId: string, index: number} | null>(null);
  dataContext = signal<'template' | 'overrides'>('template');

  // --- Enums for template access ---
  DataType = DataType;
  ScopeLevel = ScopeLevel;

  // --- Computed Signals ---
  
  currentTemplate = computed(() => {
    return this.templates().find(t => t.parameterTemplateId === this.selectedTemplateId());
  });

  resources = computed(() => {
    const all = this.templates().map(t => t.resourceId).filter(id => !!id);
    return [...new Set(all)];
  });

  filteredTemplates = computed(() => {
    const resId = this.selectedResourceId();
    if (!resId) return [];
    return this.templates().filter(t => t.resourceId === resId);
  });

  isMetadataReadOnly = computed(() => {
    const status = this.currentTemplate()?.status;
    return this.activeTab() === 'edit' || status === 1 || status === 2;
  });

  isValuesReadOnly = computed(() => {
    const status = this.currentTemplate()?.status;
    return status === 2;
  });

  canAddRemoveParameters = computed(() => {
    const status = this.currentTemplate()?.status;
    return this.activeTab() !== 'edit' && status === 0;
  });

  visibleDefinitions = computed(() => {
    const all = this.definitions();
    const visible: ParameterDefinition[] = [];
    const findVisible = (path: string) => {
        const children = all.filter(d => d.parentPath === path && d.isActive);
        children.forEach(child => {
            visible.push(child);
            if (+child.dataType === DataType.Object || +child.dataType === DataType.ObjectArray) {
                findVisible(path ? path + '.' + child.keyName : child.keyName);
            }
        });
    };
    findVisible('');
    return visible;
  });

  hasGlobalErrors = computed(() => {
    return this.visibleDefinitions().some(def => {
      if (this.getMetadataError(def, 'label') || this.getMetadataError(def, 'keyName')) return true;
      if (def.defaultValues && def.defaultValues.length > 0) {
        for (let i = 0; i < def.defaultValues.length; i++) {
          if (this.getValidationError(def, i)) return true;
        }
      } else if (def.isMandatory) return true;
      return false;
    });
  });

  isSaveButtonDisabled = computed(() => {
    return !this.hasUnsavedChanges() || this.hasGlobalErrors();
  });

  parentDefinition = computed(() => {
    const path = this.currentPath().join('.');
    if (!path) return null;
    return this.visibleDefinitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === path;
    });
  });

  currentFolderDefinitions = computed(() => {
    const pathStr = this.currentPath().join('.');
    return this.visibleDefinitions().filter(d => d.parentPath === pathStr);
  });

  arrayItemCount = computed(() => {
    const children = this.currentFolderDefinitions();
    if (children.length === 0) return 1;
    return Math.max(1, ...children.map(c => (c.defaultValues || []).length));
  });

  maxArrayItemCount = computed(() => {
    const children = this.currentFolderDefinitions();
    if (children.length === 0) return 1;
    return Math.max(1, ...children.map(c => (c.parameterValueIds || []).length));
  });

  localJson = computed(() => {
    const build = (path: string, index: number) => {
        const defs = this.definitions().filter(d => d.parentPath === path && d.isActive);
        const obj: any = {};
        defs.forEach(def => {
            const valIdx = (+def.dataType === DataType.Object || +def.dataType === DataType.ObjectArray) ? 0 : index;
            const effectiveIdx = this.getEffectiveIndexForJson(def, valIdx);
            
            if (+def.dataType === DataType.Object) {
                obj[def.keyName] = build(path ? path + '.' + def.keyName : def.keyName, 0);
            } else if (+def.dataType === DataType.ObjectArray) {
                const childPath = path ? path + '.' + def.keyName : def.keyName;
                const children = this.definitions().filter(d => d.parentPath === childPath);
                const count = children.length > 0 ? Math.max(1, ...children.map(c => (c.defaultValues || []).length)) : 1;
                obj[def.keyName] = Array.from({length: count}).map((_, i) => build(childPath, i));
            } else if (+def.dataType === DataType.StringArray) {
                const parent = this.definitions().find(d => (d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName) === def.parentPath);
                const isChildOfObjectArray = parent && +parent.dataType === DataType.ObjectArray;
                if (isChildOfObjectArray) {
                  const raw = def.defaultValues[effectiveIdx] || '';
                  obj[def.keyName] = raw ? raw.split(',').map(s => s.trim()).filter(s => s) : [];
                } else {
                  obj[def.keyName] = (def.defaultValues || []).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
                }
            } else if (+def.dataType === DataType.Boolean) {
                obj[def.keyName] = def.defaultValues[effectiveIdx] === 'true';
            } else if (+def.dataType === DataType.Integer) {
                obj[def.keyName] = parseInt(def.defaultValues[effectiveIdx]) || 0;
            } else {
                obj[def.keyName] = def.defaultValues[effectiveIdx] || '';
            }
        });
        return obj;
    };
    return build('', 0);
  });

  private getEffectiveIndexForJson(node: ParameterDefinition, index: number): number {
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === node.parentPath;
    });
    const isChildOfObjectArray = parent && +parent.dataType === DataType.ObjectArray;
    return isChildOfObjectArray ? index : 0;
  }

  // --- Core Methods ---

  selectResource(id: string) {
    if (!id || !id.trim()) return;
    this.selectedResourceId.set(id.trim());
    this.isDashboardOpen.set(true);
  }

  onTabSwitch(newTab: 'design' | 'edit' | 'preview') {
    const oldTab = this.activeTab();
    if (newTab === oldTab) return;

    // Determine intended data context
    const targetContext = newTab === 'edit' ? 'overrides' : (newTab === 'design' ? 'template' : this.dataContext());
    const needsReload = targetContext !== this.dataContext();

    if (needsReload) {
      if (this.hasUnsavedChanges()) {
        if (!confirm('Switching modes will reload data and discard your unsaved edits. Proceed?')) {
          return;
        }
      }
      this.activeTab.set(newTab);
      this.dataContext.set(targetContext);
      this.reloadAll();
    } else {
      // Toggling preview or staying in same context - PRESERVE UNSAVED DATA
      this.activeTab.set(newTab);
    }
  }

  startBlankTemplate() {
    const name = `New_Template_${Date.now()}`;
    this.selectedTemplateId.set('NEW_BLANK');
    this.definitions.set([]);
    this.tempTemplateName.set(name);
    this.isDashboardOpen.set(false);
    this.markDirty();
  }

  selectExistingTemplate(templateId: string) {
    const sourceTemplate = this.templates().find(t => t.parameterTemplateId === templateId);
    if (!sourceTemplate) return;

    // Condition: Draft (0) -> Edit Direct. Published (1) or Closed (2) -> Clone.
    if (sourceTemplate.status === 0) {
        this.selectedTemplateId.set(templateId);
        this.isDashboardOpen.set(false);
        this.reloadAll();
    } else {
        const newName = prompt('Name for the Cloned Template (Original is Published/Live):', `${sourceTemplate.templateName} (Clone)`);
        if (!newName) return;

        this.paramService.getDefinitions(templateId).subscribe(defs => {
            const oldToNewMap = new Map<string, string>();
            defs.forEach((d: any) => oldToNewMap.set(d.id!, crypto.randomUUID()));

            const clonedDefs: ParameterDefinition[] = defs.map((d: any) => ({
                ...d,
                id: oldToNewMap.get(d.id!),
                parentId: d.parentId ? oldToNewMap.get(d.parentId) : undefined,
                parameterTemplateId: undefined,
                parameterValueIds: undefined,
                baseParameterValueIds: undefined
            }));

            this.definitions.set(clonedDefs);
            this.selectedTemplateId.set('NEW_CLONE');
            this.tempTemplateName.set(newName);
            this.isDashboardOpen.set(false);
            this.markDirty();
        });
    }
  }

  onJsonFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = JSON.parse(e.target?.result as string);
            const name = prompt('Name for this imported template:', file.name.replace('.json', ''));
            if (!name) return;
            const defs = this.parseJsonRecursive(content);
            this.definitions.set(defs);
            this.selectedTemplateId.set('NEW_IMPORT');
            this.tempTemplateName.set(name);
            this.isDashboardOpen.set(false);
            this.markDirty();
        } catch (err) { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
  }

  private parseJsonRecursive(obj: any, path: string = '', parentId?: string): ParameterDefinition[] {
    const result: ParameterDefinition[] = [];
    if (!obj || typeof obj !== 'object') return [];

    Object.keys(obj).forEach(key => {
        const val = obj[key];
        let type = DataType.String;
        if (typeof val === 'boolean') type = DataType.Boolean;
        else if (typeof val === 'number') type = DataType.Integer;
        else if (Array.isArray(val)) {
            if (val.length > 0 && typeof val[0] === 'object') type = DataType.ObjectArray;
            else type = DataType.StringArray;
        } else if (typeof val === 'object') type = DataType.Object;

        const id = crypto.randomUUID();
        const def: ParameterDefinition = {
            id: id, keyName: key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            parentId: parentId, parentPath: path, dataType: type,
            isActive: true, isMandatory: false, isDepreciated: false,
            scopeLevel: ScopeLevel.Global, paramCategory: ParamCategory.Configuration,
            displayOrder: result.length, defaultValues: []
        };

        if (type === DataType.ObjectArray) {
            const firstItemDefs = this.parseJsonRecursive(val[0], path ? `${path}.${key}` : key, id);
            result.push(...firstItemDefs);
            def.defaultValues = val.map(() => '');
        } else if (type === DataType.Object) {
            const children = this.parseJsonRecursive(val, path ? `${path}.${key}` : key, id);
            result.push(...children);
        } else if (type === DataType.StringArray) {
            def.defaultValues = val.map((v: any) => String(v));
        } else {
            def.defaultValues = [String(val)];
        }
        result.push(def);
    });
    return result;
  }

  reloadAll() {
    if (!this.selectedTemplateId()) {
      this.definitions.set([]);
      return;
    }
    
    if (this.dataContext() === 'template') {
      this.paramService.getDefinitions(this.selectedTemplateId()!).subscribe(defs => {
        this.definitions.set(defs);
        this.originalStateSnapshot.set(JSON.stringify(defs));
        this.hasUnsavedChanges.set(false);
        this.deletedIds.clear();
        this.refreshJson();
      });
    } else if (this.dataContext() === 'overrides') {
      this.paramService.getOverrideDefinitions(this.previewNodeId(), this.previewScope(), this.selectedTemplateId()!).subscribe(defs => {
        this.definitions.set(defs);
        this.originalStateSnapshot.set(JSON.stringify(defs));
        this.hasUnsavedChanges.set(false);
        this.deletedIds.clear();
        this.refreshJson();
      });
    }
  }

  saveAll() {
    if (this.activeTab() === 'edit') {
      this.saveAllOverrides();
      return;
    }

    const allDefs = this.definitions();
    allDefs.forEach(def => {
        if (+def.dataType === DataType.Object || +def.dataType === DataType.ObjectArray) return;
        const parent = allDefs.find(p => (p.parentPath ? p.parentPath + '.' + p.keyName : p.keyName) === def.parentPath);
        const isChildOfObjectArray = parent && +parent.dataType === DataType.ObjectArray;
        const isStringArray = +def.dataType === DataType.StringArray;
        if (!isChildOfObjectArray && !isStringArray) {
            let bestValue = def.defaultValues.length > 0 ? def.defaultValues[0] : '';
            if (!bestValue && def.defaultValues.length > 1 && def.defaultValues[1]) bestValue = def.defaultValues[1];
            def.defaultValues = [bestValue || ''];
        }
    });

    const isNew = this.selectedTemplateId()?.startsWith('NEW_');
    const templateIdToSave = isNew ? '00000000-0000-0000-0000-000000000000' : this.selectedTemplateId()!;

    const payload = {
      parameterTemplateId: templateIdToSave,
      resourceId: this.selectedResourceId() || undefined,
      templateName: isNew ? this.tempTemplateName() : (this.currentTemplate()?.templateName || ''),
      status: isNew ? 0 : (this.currentTemplate()?.status ?? 0),
      version: isNew ? 1 : (this.currentTemplate()?.version ?? 1),
      category: 0,
      definitions: this.definitions().map((def: any) => ({
        ...def,
        parameterTemplateId: isNew ? '00000000-0000-0000-0000-000000000000' : def.parameterTemplateId,
        defaultValues: def.defaultValues 
          ? def.defaultValues.map((v: any) => v !== null && v !== undefined ? String(v) : '') 
          : []
      }))
    };

    this.paramService.bulkUpdateDefinitions(payload).subscribe({
      next: () => {
        this.paramService.getTemplates().subscribe(tmps => {
            this.templates.set(tmps);
            if (isNew) {
                const latest = tmps.sort((a,b) => b.version - a.version).find(t => t.templateName === payload.templateName);
                if (latest) this.selectedTemplateId.set(latest.parameterTemplateId);
            }
            this.reloadAll();
            alert('All changes saved successfully!');
        });
      },
      error: (err) => { console.error('Save failed', err); alert('Failed to save changes.'); }
    });
  }

  saveAllOverrides() {
    const originalDefs: ParameterDefinition[] = JSON.parse(this.originalStateSnapshot());
    const overrides: OverrideRequest[] = [];
    this.definitions().forEach(def => {
      const origDef = originalDefs.find(o => o.id === def.id);
      if (!origDef || !origDef.baseParameterValueIds) return;
      origDef.baseParameterValueIds.forEach((baseId, origBaseIndex) => {
          const newIndex = def.parameterValueIds ? def.parameterValueIds.indexOf(baseId) : -1;
          const oldIndex = origDef.parameterValueIds ? origDef.parameterValueIds.indexOf(baseId) : -1;
          if (newIndex === -1 && oldIndex !== -1) {
              overrides.push({
                  parameterValueId: baseId, overrideValue: '', isActive: false,
                  node: this.previewScope(), nodeId: this.previewNodeId()
              });
          } else if (newIndex !== -1) {
              const currentVal = def.defaultValues[newIndex];
              const oldVal = origDef.defaultValues[oldIndex];
              if (currentVal !== oldVal) {
                  overrides.push({
                      parameterValueId: baseId, overrideValue: String(currentVal || ''),
                      isActive: true, node: this.previewScope(), nodeId: this.previewNodeId()
                  });
              }
          }
      });
    });
    if (overrides.length === 0) { alert('No changes detected in overrides.'); return; }
    this.paramService.bulkSaveOverrides(overrides).subscribe({
      next: () => { this.reloadAll(); alert('Overrides saved successfully!'); },
      error: (err) => { console.error('Override save failed', err); alert('Failed to save overrides.'); }
    });
  }

  refreshJson() {
    this.paramService.getConfiguration(this.previewNodeId(), this.previewScope()).subscribe(json => {
      this.reconstructedJson.set(json);
    });
  }

  markDirty() {
    this.hasUnsavedChanges.set(true);
    this.definitions.update(defs => [...defs]);
  }

  selectDefinition(def: ParameterDefinition) {
    this.selectedDefinition.set(def);
    this.uiRuleType.set(this.getRuleType(def));
    this.isSidebarOpen.set(true);
  }

  getEffectiveIndex(node: ParameterDefinition): number {
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === node.parentPath;
    });
    const isChildOfObjectArray = parent && +parent.dataType === DataType.ObjectArray;
    if (isChildOfObjectArray && node.parentPath === this.currentPath().join('.')) {
      return this.currentArrayIndex();
    }
    return 0;
  }

  getValidationError(def: ParameterDefinition, index: number): string | null {
    const value = def.defaultValues[index] || '';
    if (def.isMandatory && !value.trim()) return 'This field is required';
    if (def.maxLength && value.length > def.maxLength) return `Maximum length is ${def.maxLength}`;
    if (def.validationRule && def.validationRule !== 'None' && value.trim()) {
        if (def.validationRule === 'Phone') { if (!/^\+?[\d\s-]{7,15}$/.test(value)) return 'Invalid phone number format'; }
        else if (def.validationRule === 'Email') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format'; }
        else if (def.validationRule === 'Website URL') { if (!/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(value)) return 'Invalid URL format'; }
        else { try { const regex = new RegExp(def.validationRule); if (!regex.test(value)) return 'Value does not match validation rule'; } catch(e) {} }
    }
    return null;
  }

  getMetadataError(def: ParameterDefinition, field: 'label' | 'keyName'): string | null {
    if (field === 'label' && !def.label?.trim()) return 'Display Label is required';
    if (field === 'keyName' && !def.keyName?.trim()) return 'JSON Key Name is required';
    return null;
  }

  getRuleType(def: ParameterDefinition): string {
    if (!def.validationRule || def.validationRule === 'None') return 'None';
    if (['Phone', 'Email', 'Website URL'].includes(def.validationRule)) return def.validationRule;
    return 'Custom';
  }

  getTags(def: ParameterDefinition): string[] {
    if (!def) return [];
    const idx = this.getEffectiveIndex(def);
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === def.parentPath;
    });
    const isChild = parent && +parent.dataType === DataType.ObjectArray;
    if (isChild) {
      const raw = def.defaultValues[idx] || '';
      return raw ? raw.split(',').map(s => s.trim()).filter(s => s) : [];
    }
    return (def.defaultValues || []).filter(s => s && s.trim());
  }

  addTag(def: ParameterDefinition, value: string) {
    if (!value) return;
    const idx = this.getEffectiveIndex(def);
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === def.parentPath;
    });
    const isChild = parent && +parent.dataType === DataType.ObjectArray;
    if (isChild) {
      const tags = this.getTags(def);
      if (!tags.includes(value)) {
        tags.push(value);
        def.defaultValues[idx] = tags.join(', ');
      }
    } else {
      if (!def.defaultValues) def.defaultValues = [];
      if (!def.defaultValues.includes(value)) {
        if (def.defaultValues.length === 1 && !def.defaultValues[0]) def.defaultValues = [value];
        else def.defaultValues.push(value);
      }
    }
    this.markDirty();
  }

  removeTag(def: ParameterDefinition, index: number) {
    const idx = this.getEffectiveIndex(def);
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === def.parentPath;
    });
    const isChild = parent && +parent.dataType === DataType.ObjectArray;
    if (isChild) {
      const tags = this.getTags(def);
      tags.splice(index, 1);
      const newArray = [...def.defaultValues];
      newArray[idx] = tags.join(', ');
      def.defaultValues = newArray;
    } else {
      const newArray = [...def.defaultValues];
      newArray.splice(index, 1);
      def.defaultValues = newArray;
    }
    this.markDirty();
  }

  updateTag(def: ParameterDefinition, index: number, newValue: string) {
    const idx = this.getEffectiveIndex(def);
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === def.parentPath;
    });
    const isChild = parent && +parent.dataType === DataType.ObjectArray;
    if (isChild) {
      const tags = this.getTags(def);
      tags[index] = newValue;
      const newArray = [...def.defaultValues];
      newArray[idx] = tags.join(', ');
      def.defaultValues = newArray;
    } else {
      if (!def.defaultValues) def.defaultValues = [];
      def.defaultValues[index] = newValue;
    }
    this.markDirty();
  }

  addStringArrayInstance(def: ParameterDefinition, customValue?: string) {
    const idx = this.getEffectiveIndex(def);
    const parent = this.definitions().find(d => {
        const fullPath = d.parentPath ? d.parentPath + '.' + d.keyName : d.keyName;
        return fullPath === def.parentPath;
    });
    const isChild = parent && +parent.dataType === DataType.ObjectArray;
    if (isChild) {
      let tags = this.getTags(def);
      const valToAdd = customValue !== undefined ? customValue : '';
      if (tags.length === 1 && !tags[0]) tags = [valToAdd];
      else tags.push(valToAdd);
      const newArray = [...def.defaultValues];
      newArray[idx] = tags.join(', ');
      def.defaultValues = newArray;
    } else {
      if (!def.defaultValues) def.defaultValues = [];
      const valToAdd = customValue !== undefined ? customValue : '';
      if (def.defaultValues.length === 1 && !def.defaultValues[0]) def.defaultValues = [valToAdd];
      else def.defaultValues.push(valToAdd);
    }
    this.markDirty();
  }

  trackByIndex(index: number) {
    return index;
  }

  downloadParameterJson() {
     this.paramService.getConfiguration(this.previewNodeId(), this.previewScope()).subscribe(json => {
         const jsonString = JSON.stringify(json, null, 2);
         const blob = new Blob([jsonString], { type: 'application/json' });
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `TMS_Terminal_Parameters_${Date.now()}.json`;
         a.click();
         window.URL.revokeObjectURL(url);
     });
  }

  getNodesInPath(path: string): ParameterDefinition[] {
    return this.visibleDefinitions().filter(d => d.parentPath === path);
  }

  onTreeSelect(node: ParameterDefinition) {
    this.selectDefinition(node);
    this.currentArrayIndex.set(0); 
    const newPath = node.parentPath ? node.parentPath.split('.') : [];
    this.currentPath.set(newPath);
  }

  onRuleTypeChange(def: ParameterDefinition, newType: string) {
    this.markDirty();
    this.uiRuleType.set(newType);
    if (newType === 'None') def.validationRule = 'None';
    else if (newType === 'Phone') def.validationRule = 'Phone';
    else if (newType === 'Email') def.validationRule = 'Email';
    else if (newType === 'Website URL') def.validationRule = 'Website URL';
    else def.validationRule = ''; 
  }

  openNewParameter(targetPath?: string) {
    if (!this.canAddRemoveParameters()) return;
    const key = `param_${this.definitions().length + 1}`;
    const parentPath = targetPath !== undefined ? targetPath : this.currentPath().join('.');
    const id = crypto.randomUUID();
    const newDef: ParameterDefinition = {
      id: id, keyName: key, label: key,
      parentId: undefined, parentPath: parentPath,
      dataType: DataType.String, isActive: true, isMandatory: false,
      isDepreciated: false, scopeLevel: ScopeLevel.Global,
      paramCategory: ParamCategory.Configuration,
      displayOrder: this.definitions().length, defaultValues: ['']
    };
    this.definitions.update(defs => [...defs, newDef]);
    this.selectDefinition(newDef);
    this.markDirty();
  }

  performDelete(id: string) {
    if (!this.canAddRemoveParameters()) return;
    const toDelete = this.definitions().find(d => d.id === id);
    if (!toDelete) return;
    const deleteRecursive = (def: ParameterDefinition) => {
        const fullPath = def.parentPath ? def.parentPath + '.' + def.keyName : def.keyName;
        const children = this.definitions().filter(d => d.parentPath === fullPath);
        children.forEach(child => deleteRecursive(child));
        this.definitions.update(defs => defs.filter(d => d.id !== def.id));
        if (def.id && !def.id.startsWith('NEW_')) this.deletedIds.add(def.id);
    };
    deleteRecursive(toDelete);
    this.closeSidebar();
    this.markDirty();
  }

  addArrayInstance() {
    const parent = this.parentDefinition();
    if (parent && +parent.dataType === DataType.ObjectArray) {
      if (!parent.defaultValues) parent.defaultValues = [];
      parent.defaultValues.push('');
    }

    const children = this.currentFolderDefinitions();
    children.forEach(child => {
        if (!child.defaultValues) child.defaultValues = [];
        child.defaultValues.push('');
    });
    this.currentArrayIndex.set(this.arrayItemCount() - 1);
    this.markDirty();
  }

  removeArrayInstance(index: number) {
    const parent = this.parentDefinition();
    if (parent && +parent.dataType === DataType.ObjectArray && parent.defaultValues) {
      parent.defaultValues.splice(index, 1);
    }

    const children = this.currentFolderDefinitions();
    children.forEach(child => {
        if (child.defaultValues && child.defaultValues.length > index) {
            child.defaultValues.splice(index, 1);
        }
    });
    if (this.currentArrayIndex() >= this.arrayItemCount()) {
        this.currentArrayIndex.set(Math.max(0, this.arrayItemCount() - 1));
    }
    this.markDirty();
  }

  addCustomTag(def: ParameterDefinition, inputElem: HTMLInputElement) {
    const val = inputElem.value.trim();
    if (!val) return;
    this.addStringArrayInstance(def, val);
  }

  editTag(def: ParameterDefinition, tagIndex: number) {
    this.editingTagIndex.set({ defId: def.id!, index: tagIndex });
  }

  resetToRoot() {
    this.currentPath.set([]);
    this.currentArrayIndex.set(0);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
    this.selectedDefinition.set(null);
  }
}
