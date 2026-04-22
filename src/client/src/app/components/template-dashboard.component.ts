import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesignerService } from '../services/designer.service';

@Component({
  selector: 'app-template-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-overlay">
       <div class="dashboard-modal">
          <header class="dashboard-header">
             <h2>Select Template</h2>
             <button class="btn-close-dash" (click)="state.isDashboardOpen.set(false)">×</button>
          </header>

          <main class="dashboard-body">
             <aside class="dashboard-sidebar">
                <button [class.active]="state.dashboardCategory() === 'Simple'" (click)="state.dashboardCategory.set('Simple')">
                   <div class="nav-icon">📊</div>
                   Simple
                </button>
                <button [class.active]="state.dashboardCategory() === 'Design'" (click)="state.dashboardCategory.set('Design')">
                   <div class="nav-icon">🏗️</div>
                   Design
                </button>
             </aside>

             <section class="dashboard-content">
                <div class="dash-section">
                   <h3>New Template</h3>
                   <div class="card-grid">
                      <div class="dash-card action-card" (click)="state.startBlankTemplate()">
                         <div class="card-icon">+</div>
                         <div class="card-footer">Blank Template</div>
                      </div>

                      <div class="dash-card upload-card" (click)="jsonInput.click()">
                         <input #jsonInput type="file" (change)="state.onJsonFileSelected($event)" style="display:none" accept=".json">
                         <div class="card-icon">☁️</div>
                         <div class="card-info">
                            <p>Create a template</p>
                            <p class="sub">by uploading an existing template file.</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div class="dash-section" style="margin-top:30px;">
                   <h3>List of templates to choose (Resource: {{state.selectedResourceId()}})</h3>
                   <div class="card-grid">
                      @for (tmp of state.filteredTemplates(); track tmp.parameterTemplateId) {
                         <div class="dash-card template-card" (click)="state.selectExistingTemplate(tmp.parameterTemplateId)">
                            <div class="card-thumb">
                               <div class="thumb-lines"></div>
                               <div class="thumb-tag">System Preference</div>
                            </div>
                            <div class="card-footer">{{tmp.templateName}}</div>
                         </div>
                      }
                      @if (state.filteredTemplates().length === 0) {
                         <div style="color:#94a3b8; font-size:0.9rem; padding:20px; border:2px dashed #e2e8f0; border-radius:8px; text-align:center;">
                            No existing templates for this resource. Start with a blank or upload!
                         </div>
                      }
                   </div>
                </div>
             </section>

             <aside class="dashboard-desc">
                <h4>Introduction</h4>
                <p>Modern template designer allows you to structure terminal parameters with high integrity.</p>
                <h4 style="margin-top:20px;">Support</h4>
                <p>Importing JSON will automatically setup your design structure. All existing templates will be **Cloned** to preserve originals.</p>
             </aside>
          </main>

          <footer class="dashboard-footer">
             <button class="btn-cancel" (click)="state.isDashboardOpen.set(false)">Cancel</button>
             <button class="btn-confirm" [disabled]="!state.selectedTemplateId()" (click)="state.isDashboardOpen.set(false)">Confirm</button>
          </footer>
       </div>
    </div>
  `,
  styleUrls: ['./template-dashboard.component.css']
})
export class TemplateDashboardComponent {
  state = inject(DesignerService);
}
