import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesignerService } from '../services/designer.service';

@Component({
  selector: 'app-resource-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="center-workspace" style="display:flex; justify-content:center; align-items:center; flex-direction:column; min-height: 80vh; background: #f1f5f9;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; width: 100%; max-width: 500px;">
        <h2 style="font-size: 1.8rem; margin-bottom: 25px; color:#1e293b;">Select Resource</h2>
        
        <div style="text-align: left; display:flex; flex-direction:column; gap:20px;">
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #475569;">Resource ID</label>
            <select #resSelect style="width: 100%; padding: 14px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1.1rem; background: #f8fafc; color: #0f172a; outline: none; cursor: pointer;"
                    (change)="state.selectResource(resSelect.value)">
              <option value="" disabled selected>-- Choose a Resource --</option>
              @for (res of state.resources(); track res) {
                <option [value]="res">{{res}}</option>
              }
            </select>
          </div>
          
          <div style="display:flex; align-items:center; gap:10px;">
            <hr style="flex:1; border-top:1px solid #e2e8f0;">
            <span style="font-size:0.8rem; color:#94a3b8;">OR</span>
            <hr style="flex:1; border-top:1px solid #e2e8f0;">
          </div>

          <div>
             <input #newResInput type="text" placeholder="Enter new Resource ID..." 
                    style="width: 100%; padding: 14px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1.1rem; box-sizing:border-box;"
                    (keyup)="0">
             <button style="width:100%; margin-top:10px; padding:12px; background:#4f46e5; color:white; border:none; border-radius:6px; cursor:pointer;"
                     [disabled]="!newResInput.value.trim()"
                     [style.font-weight]="'600'"
                     [style.opacity]="newResInput.value.trim() ? 1 : 0.5"
                     (click)="state.selectResource(newResInput.value)">
                Continue to Dashboard
             </button>
          </div>
        </div>
      </div>
    </main>
  `
})
export class ResourceSelectorComponent {
  state = inject(DesignerService);
}
