import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { FormManagerComponent } from './components/form-manager/form-manager.component';
import { WorkflowManagerComponent } from './components/workflow-manager/workflow-manager.component';
import { RuleManagerComponent } from './components/rule-manager/rule-manager.component';
import { TaskManagerComponent } from './components/task-manager/task-manager.component';
import { MenuManagerComponent } from './components/menu-manager/menu-manager.component';
import { CustomCrudComponent } from './components/custom-crud/custom-crud.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard/form-list', pathMatch: 'full' },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    children: [
      { path: '', redirectTo: 'form-list', pathMatch: 'full' },

      // Form Manager routes
      {
        path: 'form-list',
        children: [
          { path: '', component: FormManagerComponent },
          { path: 'new', component: FormManagerComponent },
          { path: 'edit/:id', component: FormManagerComponent },
          { path: 'preview/:id', component: FormManagerComponent },
        ]
      },

      // Workflow Manager routes
      {
        path: 'workflow-list',
        children: [
          { path: '', component: WorkflowManagerComponent },
          { path: 'new', component: WorkflowManagerComponent },
          { path: 'edit/:id', component: WorkflowManagerComponent },
        ]
      },

      { path: 'rule-list', component: RuleManagerComponent },
      { path: 'my-tasks', component: TaskManagerComponent },
      { path: 'menu-list', component: MenuManagerComponent },

      // Dynamic CRUD mapping (must be last)
      { path: ':id', component: CustomCrudComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard/form-list' }
];
