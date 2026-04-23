import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DesignerService } from '../services/designer.service';
import { ParameterDefinition, DataType, ScopeLevel, ParamCategory } from '../models/parameter.models';

@Component({
  selector: 'app-designer-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (state.isStringArrayDropdownOpen()) {
      <div (click)="state.isStringArrayDropdownOpen.set(null)" 
           style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(248, 250, 252, 0.7); z-index: 998; cursor: default;">
      </div>
    }

    <!-- MAIN WORKSPACE HEADER -->
    <header class="glass-header">
      <div class="logo">
        <h1>💠 TMS Parameter Designer</h1>
      </div>

      <nav class="tabs">
        <button [class.active]="state.activeTab() === 'design'" (click)="state.onTabSwitch('design')">Design</button>
        <button [class.active]="state.activeTab() === 'preview'" (click)="state.onTabSwitch('preview')">Preview JSON</button>
        <button [class.active]="state.activeTab() === 'edit'" (click)="state.onTabSwitch('edit')">Edit Parameter</button>
      </nav>
      
      <div class="header-actions">
        <button style="margin-right:15px; padding:8px 15px; border:none; border-radius:5px; background:#10b981; color:white; cursor:pointer; font-weight:500;" 
                (click)="state.downloadParameterJson()">
          ⬇ Download JSON
        </button>
        <button style="margin-right:20px; padding:8px 15px; border:none; border-radius:5px; background:#475569; color:white; cursor:pointer;" 
                (click)="state.selectedTemplateId.set(null); state.definitions.set([]);">
          ⬅ Templates
        </button>
        <button class="btn-save" [class.dirty]="state.hasUnsavedChanges()" (click)="state.saveAll()" [disabled]="state.isSaveButtonDisabled()">
          💾 SAVE ALL
        </button>
      </div>
    </header>

    <!-- DESIGN & EDIT TAB CONTENT -->
    @if (state.activeTab() === 'design' || state.activeTab() === 'edit') {
      <main class="main-layout">
        <!-- 1. LEFT SIDE: Structure Sidebar -->
        <aside class="sidebar-tree">
          <div class="sidebar-header">
            <h2>DESIGN STRUCTURE</h2>
          </div>
          <div class="sidebar-content" style="padding: 10px 0;">
            <div class="tree-root-item" [class.active]="state.currentPath().length === 0" (click)="state.resetToRoot()">
              <span>🏠 Root</span>
              @if (state.canAddRemoveParameters()) {
                <button class="btn-add-node" title="Add to Root" (click)="state.openNewParameter(''); $event.stopPropagation()">+</button>
              }
            </div>
            <div class="tree-container">
              <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: '' }"></ng-container>
            </div>
          </div>
        </aside>

        <!-- 2. MIDDLE: Center Workspace (Grid View) -->
        <section class="center-workspace" (click)="state.closeSidebar()">
          <nav class="breadcrumbs">
            <span (click)="state.resetToRoot()">Root</span>
            @for (seg of state.currentPath(); track $index) {
              <span class="sep">/</span>
              <span (click)="onBreadcrumbClick($index)">{{seg}}</span>
            }
            @if (state.currentPath().length > 0) {
              <button class="btn-back" (click)="goBack()" style="margin-left: 15px; background:#f1f5f9; border:1px solid #e2e8f0; padding:4px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">← Back</button>
            }
          </nav>

          <!-- ObjectArray Item Tabs -->
          @if (state.parentDefinition()?.dataType === DataType.ObjectArray) {
            <div class="array-item-toolbar" (click)="$event.stopPropagation()" style="margin-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
                <div class="item-selector-tabs" style="display:flex; gap:10px;">
                  @for (item of [].constructor(state.arrayItemCount()); track $index) {
                      <button style="padding: 10px 20px; border:none; background:transparent; border-bottom: 3px solid transparent; cursor:pointer;"
                              [style.border-bottom-color]="state.currentArrayIndex() === $index ? '#2563eb' : 'transparent'"
                              [style.color]="state.currentArrayIndex() === $index ? '#2563eb' : '#64748b'"
                              (click)="state.currentArrayIndex.set($index)">
                          Item {{$index + 1}}
                          @if (state.arrayItemCount() > 1) {
                              <span style="margin-left:8px; opacity:0.5; color:red;" (click)="$event.stopPropagation(); removeArrayInstance($index)">×</span>
                          }
                      </button>
                  }
                  @if (state.activeTab() !== 'edit' || state.arrayItemCount() < state.maxArrayItemCount()) {
                    <button style="padding: 10px 20px; border:none; background:transparent; color:#2563eb; cursor:pointer; font-weight:600;" (click)="state.addArrayInstance()">+ Add Item</button>
                  }
                </div>
            </div>
          }

          <!-- Grid View Params -->
          <div class="card-grid">
            @for (node of state.currentFolderDefinitions(); track node.id) {
              <div class="minimal-card" [class.selected]="state.selectedDefinition() === node" 
                   [style.z-index]="state.isStringArrayDropdownOpen()?.includes(node.id!) ? 1001 : 'auto'"
                   (click)="state.selectDefinition(node); $event.stopPropagation()">
                <div class="card-header-row">
                  <div>
                    <div class="card-title">{{node.label || node.keyName}}</div>
                    <div class="card-tags" style="margin-top: 8px;">
                      <span class="type-badge">{{DataType[+node.dataType]}}</span>
                      <span class="scope-badge">{{ScopeLevel[+node.scopeLevel]}}</span>
                    </div>
                  </div>
                  @if (state.canAddRemoveParameters()) {
                    <span class="card-close-x" (click)="deleteFromCard($event, node)">×</span>
                  }
                </div>
                
                <div class="card-value-box" [class.input-error]="state.getValidationError(node, state.getEffectiveIndex(node))">
                  @if (+node.dataType === DataType.Object || +node.dataType === DataType.ObjectArray) {
                    <div class="flex-spread" (click)="onCardSelect(node); $event.stopPropagation()" style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                      <span style="font-style:italic; color:#94a3b8; font-size:0.9rem;">(Enter Folder)</span>
                      <span style="font-size:1.2rem;">📂</span>
                    </div>
                  } @else if (+node.dataType === DataType.StringArray) {
                    <div class="pill-container" style="position:relative; width: 100%; height: 100%;">
                      <div class="mock-input" (click)="state.isStringArrayDropdownOpen.set(node.id! + '_card'); $event.stopPropagation();" style="display:flex; flex-wrap:wrap; gap:4px; align-items:flex-start; cursor:pointer; width:100%; height:100%; min-height: 40px; padding:6px; box-sizing:border-box;">
                          @for (tag of state.getTags(node); track $index) {
                             <span style="background: #f1f5f9; border: 1px solid #cbd5e1; color:#334155; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">{{tag}}</span>
                          }
                          @if (state.getTags(node).length === 0) {
                             <span style="color: #94a3b8; font-size: 0.8rem; padding: 2px;">+ Add Items</span>
                          }
                      </div>
                      @if (state.isStringArrayDropdownOpen() === node.id + '_card') {
                        <div style="position: relative; z-index: 1000;">
                          <ng-container *ngTemplateOutlet="stringArrayModalTemplate; context: { def: node }"></ng-container>
                        </div>
                      }
                    </div>
                  } @else {
                    <div style="width:100%;">
                      @if (+node.dataType === DataType.Boolean) {
                        <select class="card-inline-input"
                                [(ngModel)]="node.defaultValues[state.getEffectiveIndex(node)]"
                                (ngModelChange)="state.markDirty()"
                                [disabled]="state.isValuesReadOnly()">
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      } @else if (+node.dataType === DataType.Integer) {
                        <input type="number" class="card-inline-input" 
                               [(ngModel)]="node.defaultValues[state.getEffectiveIndex(node)]" 
                               (ngModelChange)="state.markDirty()"
                               [disabled]="state.isValuesReadOnly()"
                               placeholder="0">
                      } @else {
                        <input type="text" class="card-inline-input" 
                               [(ngModel)]="node.defaultValues[state.getEffectiveIndex(node)]" 
                               (ngModelChange)="state.markDirty()"
                               [disabled]="state.isValuesReadOnly()"
                               placeholder="Set default value...">
                      }
                    </div>
                  }
                </div>
                @if (state.getValidationError(node, state.getEffectiveIndex(node)); as err) {
                  <div class="error-text">⚠️ {{err}}</div>
                }
              </div>
            }
            @if (state.canAddRemoveParameters()) {
              <div class="add-parameter-card" style="border: 2px dashed #cbd5e1; background: #f8fafc; height: 180px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; cursor:pointer;" (click)="state.openNewParameter()">
                <div style="font-size: 2.5rem; color: #cbd5e1;">+</div>
                <div style="font-weight: 700; color: #64748b;">Add Parameter Node</div>
              </div>
            }
          </div>
        </section>

        <!-- 3. RIGHT SIDE: Full Properties Sidebar -->
        <aside class="properties-sidebar" (click)="$event.stopPropagation()">
          <div class="sidebar-header">
            <h2>PROPERTIES</h2>
          </div>
          <div class="sidebar-content">
            @if (state.selectedDefinition(); as def) {
              <div class="form-group" style="margin-top: 0;">
                <label>Display Label <span class="required-star">*</span></label>
                <input type="text" [(ngModel)]="def.label" (ngModelChange)="onLabelChange(def)" 
                       [disabled]="state.isMetadataReadOnly()" [class.input-error]="state.getMetadataError(def, 'label')">
                @if (state.getMetadataError(def, 'label'); as err) { <div class="error-text">{{err}}</div> }
              </div>
              
              <div class="form-group">
                <label>JSON Key Name <span class="required-star">*</span></label>
                <input type="text" [(ngModel)]="def.keyName" (ngModelChange)="state.markDirty()" 
                       [disabled]="state.isMetadataReadOnly()" [class.input-error]="state.getMetadataError(def, 'keyName')">
                @if (state.getMetadataError(def, 'keyName'); as err) { <div class="error-text">{{err}}</div> }
              </div>

              <div class="form-group">
                  <label>Data Type</label>
                  <select [(ngModel)]="def.dataType" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                      <option [value]="DataType.String">String</option>
                      <option [value]="DataType.Integer">Integer</option>
                      <option [value]="DataType.Boolean">Boolean</option>
                      <option [value]="DataType.StringArray">String Array</option>
                      <option [value]="DataType.Object">Object (Folder)</option>
                      <option [value]="DataType.ObjectArray">Object Array (Folder List)</option>
                      <option [value]="DataType.HexString">Hex String</option>
                  </select>
              </div>

              <!-- DYNAMIC DEFAULT VALUE SECTION -->
              @if (+def.dataType !== DataType.Object && +def.dataType !== DataType.ObjectArray) {
                <div class="form-group" [style.z-index]="state.isStringArrayDropdownOpen()?.includes(def.id!) ? 1001 : 'auto'" style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; position: relative;">
                  <label>Default Value <span class="required-star" *ngIf="def.isMandatory">*</span></label>
                  
                  @if (+def.dataType === DataType.Boolean) {
                    <select [(ngModel)]="def.defaultValues[state.getEffectiveIndex(def)]" (ngModelChange)="state.markDirty()" [disabled]="state.isValuesReadOnly()" style="background: white;">
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  } @else if (+def.dataType === DataType.Integer) {
                    <input type="number" [(ngModel)]="def.defaultValues[state.getEffectiveIndex(def)]" (ngModelChange)="state.markDirty()" [disabled]="state.isValuesReadOnly()" style="background: white;" placeholder="0">
                  } @else if (+def.dataType === DataType.StringArray) {
                    <div class="pill-container" style="position:relative; width: 100%;">
                      <div class="mock-input" (click)="state.isStringArrayDropdownOpen.set(def.id! + '_prop'); $event.stopPropagation();" 
                           style="display:flex; flex-wrap:wrap; gap:4px; align-items:flex-start; cursor:pointer; width:100%; min-height: 40px; padding:8px; background:white; border:1px solid #d1d5db; border-radius:6px;">
                          @for (tag of state.getTags(def); track $index) {
                             <span style="background: #f1f5f9; border: 1px solid #cbd5e1; color:#334155; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">{{tag}}</span>
                          }
                          @if (state.getTags(def).length === 0) {
                             <span style="color: #94a3b8; font-size: 0.8rem; padding: 2px;">+ Add Items</span>
                          }
                      </div>
                      @if (state.isStringArrayDropdownOpen() === (def.id! + '_prop')) {
                          <div style="position: relative; z-index: 1000;">
                            <ng-container *ngTemplateOutlet="stringArrayModalTemplate; context: { def: def }"></ng-container>
                          </div>
                      }
                    </div>
                  } @else {
                    <input type="text" [(ngModel)]="def.defaultValues[state.getEffectiveIndex(def)]" (ngModelChange)="state.markDirty()" [disabled]="state.isValuesReadOnly()" style="background: white;" placeholder="Enter default value...">
                  }
                  
                  @if (state.getValidationError(def, state.getEffectiveIndex(def)); as err) {
                    <div class="error-text">⚠️ {{err}}</div>
                  }
                </div>
              }

              <div class="form-row">
                  <div class="form-group" style="flex:1;">
                    <label>Scope Level</label>
                    <select [(ngModel)]="def.scopeLevel" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                        <option [value]="ScopeLevel.Global">Global</option>
                        <option [value]="ScopeLevel.Merchant">Merchant</option>
                        <option [value]="ScopeLevel.Outlet">Outlet</option>
                        <option [value]="ScopeLevel.Terminal">Terminal</option>
                    </select>
                  </div>
                  <div class="form-group" style="flex:1;">
                    <label>Category</label>
                    <select [(ngModel)]="def.paramCategory" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                        <option [value]="ParamCategory.Configuration">Configuration</option>
                        <option [value]="ParamCategory.Transaction">Transaction</option>
                    </select>
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group" style="flex:1;">
                    <label>Max Length</label>
                    <input type="number" [(ngModel)]="def.maxLength" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                  </div>
                  <div class="form-group" style="flex:1;">
                    <label>Display Order</label>
                    <input type="number" [(ngModel)]="def.displayOrder" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                  </div>
              </div>

              <div class="form-group">
                  <label>Validation Rule</label>
                  <select [ngModel]="state.uiRuleType()" (ngModelChange)="onRuleTypeChange(def, $event)" [disabled]="state.isMetadataReadOnly()">
                      <option value="None">None (Open String)</option>
                      <option value="Phone">Phone Number</option>
                      <option value="Email">Email Address</option>
                      <option value="Website URL">Website URL</option>
                      <option value="Custom">Custom Regex...</option>
                  </select>
              </div>
              @if (state.uiRuleType() === 'Custom') {
                  <div class="form-group">
                      <label>Regex Pattern</label>
                      <input type="text" [(ngModel)]="def.validationRule" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()" placeholder="e.g. ^[0-9]{4}$">
                  </div>
              }

              <div class="form-group">
                <label>Description</label>
                <textarea rows="3" [(ngModel)]="def.description" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()" placeholder="Usage instructions..."></textarea>
              </div>

              <div class="checkbox-row">
                  <label class="form-toggle">
                    <input type="checkbox" [(ngModel)]="def.isActive" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                    Is Active
                  </label>
                  <label class="form-toggle">
                    <input type="checkbox" [(ngModel)]="def.isMandatory" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                    Mandatory
                  </label>
                  <label class="form-toggle">
                    <input type="checkbox" [(ngModel)]="def.isDepreciated" (ngModelChange)="state.markDirty()" [disabled]="state.isMetadataReadOnly()">
                    Deprecated
                  </label>
              </div>

            } @else {
              <div class="empty-state">
                <div class="empty-icon">⚙️</div>
                <p>Select a parameter to view and edit its full property set.</p>
              </div>
            }
          </div>
        </aside>
      </main>
    }

    <!-- PREVIEW TAB CONTENT -->
    @if (state.activeTab() === 'preview') {
      <main class="center-workspace" style="padding: 20px; display: flex; flex-direction: column;">
          <div class="preview-mode-header" style="display: flex; gap: 10px; margin-bottom: 20px; background: #f1f5f9; padding: 6px; border-radius: 8px; width: fit-content;">
             <button [style.background]="state.dataContext() === 'template' ? 'white' : 'transparent'" 
                     [style.box-shadow]="state.dataContext() === 'template' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'"
                     [style.color]="state.dataContext() === 'template' ? '#1e293b' : '#64748b'"
                     style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s;"
                     (click)="state.onTabSwitch('design'); state.activeTab.set('preview')">
                Template Preview
             </button>
             <button [style.background]="state.dataContext() === 'overrides' ? 'white' : 'transparent'" 
                     [style.box-shadow]="state.dataContext() === 'overrides' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'"
                     [style.color]="state.dataContext() === 'overrides' ? '#1e293b' : '#64748b'"
                     style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s;"
                     (click)="state.onTabSwitch('edit'); state.activeTab.set('preview')">
                Terminal Overrides
             </button>
          </div>

          <div class="json-live-preview" style="background:#0f172a; color:#a5b4fc; padding:20px; border-radius:12px; flex: 1; border: 1px solid #334155; position: relative;">
             <div style="position: absolute; top: 10px; right: 20px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700;">
                {{state.dataContext() === 'template' ? 'Mode: Design / Template' : 'Mode: Edit / Overrides'}}
             </div>
             <pre style="margin:0; font-family:'JetBrains Mono', monospace; font-size:0.9rem; line-height: 1.5; overflow-x:auto; white-space:pre-wrap;">{{state.localJson() | json}}</pre>
          </div>
      </main>
    }

    <!-- RECURSIVE TREE TEMPLATE -->
    <ng-template #treeNodeTemplate let-path>
      @for (node of state.getNodesInPath(path); track node.id) {
        <div class="tree-item">
          <div class="tree-node" [class.active]="state.selectedDefinition() === node" (click)="state.onTreeSelect(node)">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span>{{(+node.dataType === DataType.Object || +node.dataType === DataType.ObjectArray) ? '📁' : '📄'}} {{node.label || node.keyName}}</span>
                @if (+node.dataType === DataType.Object || +node.dataType === DataType.ObjectArray) {
                    @if (state.canAddRemoveParameters()) {
                      <button class="btn-add-node" title="Add to Folder" (click)="state.openNewParameter(node.parentPath ? node.parentPath + '.' + node.keyName : node.keyName); $event.stopPropagation()">+</button>
                    }
                }
            </div>
          </div>
          @if (+node.dataType === DataType.Object || +node.dataType === DataType.ObjectArray) {
            <div style="margin-left:15px; border-left:1px solid #ddd;">
               <ng-container *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: node.parentPath ? node.parentPath + '.' + node.keyName : node.keyName }"></ng-container>
            </div>
          }
        </div>
      }
    </ng-template>

    <ng-template #stringArrayModalTemplate let-def="def">
       <div class="dropdown-modal" style="position: absolute; top: calc(100% + 5px); left: 0; width: 100%; min-width: 280px; z-index: 1000; background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); animation: zoomIn 0.15s ease-out; box-sizing: border-box;">
          <div style="margin-bottom: 12px;">
             <input #newTagInp type="text" 
                    style="width: 100%; padding: 11px; border: 1.5px solid #2563eb; border-radius: 8px; font-size: 0.95rem; outline: none; box-sizing: border-box;" 
                    placeholder="Press Enter to add new item" 
                    (keydown.enter)="state.addCustomTag(def, newTagInp); newTagInp.value=''">
          </div>
          
          <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
             @for (tag of state.getTags(def); track $index) {
                <div style="display:flex; align-items:center; justify-content:space-between; padding: 6px 4px; transition: background 0.2s; border-radius: 6px;">
                   @if (state.editingTagIndex()?.defId === def.id && state.editingTagIndex()?.index === $index) {
                      <input #editInp type="text" 
                             [value]="tag" 
                             style="flex: 1; padding: 4px 8px; border: 1.5px solid #2563eb; border-radius: 4px; font-size: 0.85rem; outline: none;"
                             (keydown.enter)="state.updateTag(def, $index, editInp.value); state.editingTagIndex.set(null)"
                             (blur)="state.updateTag(def, $index, editInp.value); state.editingTagIndex.set(null)"
                             [autofocus]="true">
                   } @else {
                      <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; color: #475569; font-weight: 500;">{{tag}}</span>
                   }
                   <div style="display:flex; gap: 8px; align-items: center;">
                      <!-- EDIT ICON (Premium Styled) -->
                      <div (click)="state.editTag(def, $index)" style="cursor:pointer; padding: 4px; border-radius: 4px; transition: background 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <svg style="width: 18px; height: 18px; color: #ff5a1f;" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </div>
                      <!-- DELETE ICON (Premium Styled) -->
                      <div (click)="state.removeTag(def, $index)" style="cursor:pointer; padding: 4px; border-radius: 4px; transition: background 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                        <svg style="width: 18px; height: 18px; color: #9ca3af;" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                      </div>
                   </div>
                </div>
             }
             @if (state.getTags(def).length === 0) {
               <div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 20px;">No items added yet.</div>
             }
          </div>
          
          <div style="margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 12px; font-size: 0.85rem; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
             <span style="font-weight: 500;">{{state.getTags(def).length}} / 100</span>
             <span style="cursor:pointer; color: #1e293b; font-weight: 700; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#1e293b'" (click)="state.isStringArrayDropdownOpen.set(null)">Close</span>
          </div>
       </div>
    </ng-template>
  `,
  styleUrls: ['./designer-workspace.component.css']
})
export class DesignerWorkspaceComponent {
  state = inject(DesignerService);
  DataType = DataType;
  ScopeLevel = ScopeLevel;
  ParamCategory = ParamCategory;

  onBreadcrumbClick(index: number) {
    const p = this.state.currentPath().slice(0, index + 1);
    this.state.currentPath.set(p);
    this.state.currentArrayIndex.set(0);
  }

  goBack() {
    const p = [...this.state.currentPath()];
    p.pop();
    this.state.currentPath.set(p);
    this.state.currentArrayIndex.set(0);
  }

  onCardSelect(node: ParameterDefinition) {
    if (+node.dataType === DataType.Object || +node.dataType === DataType.ObjectArray) {
      this.state.currentArrayIndex.set(0);
      const newPath = [...this.state.currentPath(), node.keyName];
      this.state.currentPath.set(newPath);
    }
  }

  deleteFromCard(event: Event, node: ParameterDefinition) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete '${node.label || node.keyName}'?`)) {
      this.state.performDelete(node.id!);
    }
  }

  onLabelChange(def: ParameterDefinition) {
    this.state.markDirty();
    if (def.label) {
      // Auto-generate key name using snake_case as requested
      const snakeCase = def.label
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')           // Replace spaces with underscores
        .replace(/[^a-z0-9_]/g, '');     // Remove non-alphanumeric chars except underscores
      
      // Update keyName aggressive auto-populate as requested
      def.keyName = snakeCase;
    }
  }

  onRuleTypeChange(def: ParameterDefinition, val: string) {
    this.state.onRuleTypeChange(def, val);
  }

  removeArrayInstance(index: number) {
    if (confirm(`Remove instance ${index + 1}?`)) {
      this.state.removeArrayInstance(index);
    }
  }

  editTag(def: ParameterDefinition, tagIndex: number) {
    this.state.editingTagIndex.set({ defId: def.id!, index: tagIndex });
  }
}
