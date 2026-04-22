import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesignerService } from './services/designer.service';
import { ParameterService } from './services/parameter.service';
import { ResourceSelectorComponent } from './components/resource-selector.component';
import { TemplateDashboardComponent } from './components/template-dashboard.component';
import { DesignerWorkspaceComponent } from './components/designer-workspace.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    ResourceSelectorComponent, 
    TemplateDashboardComponent, 
    DesignerWorkspaceComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  public state = inject(DesignerService);
  private paramService = inject(ParameterService);

  ngOnInit() {
    this.paramService.getTemplates().subscribe(tmps => {
      this.state.templates.set(tmps);
    });
  }
}
