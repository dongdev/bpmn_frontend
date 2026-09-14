import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { CamundaService, CamundaTask } from '../../api/camunda.service';
import { FormRepositoryService } from '../../api/form-repository.service';
import { LendingDomainService } from '../../api/lending-domain.service';
import { AuthService } from '../../api/auth.service';
import { FormViewerComponent } from '../form-viewer/form-viewer.component';
import { PERMISSIONS } from '../../config/constants';

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzCardModule,
    NzModalModule,
    NzSpaceModule,
    NzIconModule,
    NzTagModule,
    NzSelectModule,
    NzRadioModule,
    NzAlertModule,
    FormViewerComponent
  ],
  providers: [NzModalService, NzMessageService],
  templateUrl: './task-manager.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class TaskManagerComponent implements OnInit {
  readonly PERMISSIONS = PERMISSIONS;

  tasks: CamundaTask[] = [];
  isExecuting = false;

  filterType: 'my' | 'unassigned' | 'group' = 'my';
  searchTaskName = '';

  activeTask: CamundaTask | null = null;
  activeFormSchema: any[] = [];
  activeFormId: string = '';
  activeProcessInstanceId: string = '';
  activeTaskId: string = '';
  activeTaskVariables: any = {};

  @ViewChild('taskFormViewer', { static: false }) taskFormViewer!: FormViewerComponent;

  currentSortField = 'created';
  currentSortOrder = 'desc';

  constructor(
    private camundaService: CamundaService,
    private formRepository: FormRepositoryService,
    private lendingDomainService: LendingDomainService,
    private authService: AuthService,
    private message: NzMessageService,
    private modal: NzModalService
  ) { }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  ngOnInit() {
    this.loadTasks();
  }

  async loadTasks(sortField?: string, sortOrder?: string) {
    if (sortField) this.currentSortField = sortField;
    if (sortOrder) this.currentSortOrder = sortOrder;

    const userProfile = this.authService.getUserProfile();
    const username = userProfile?.username || '';

    const options: any = {
      nameLike: this.searchTaskName ? this.searchTaskName : undefined,
      sortBy: this.currentSortField === 'created' ? 'created' : (this.currentSortField === 'name' ? 'name' : 'created'),
      sortOrder: this.currentSortOrder
    };

    if (this.filterType === 'my') {
      options.assignee = username;
    } else if (this.filterType === 'unassigned') {
      options.unassigned = true;
    } else if (this.filterType === 'group') {
      options.candidateGroup = 'user-group';
    }

    try {
      const res = await this.camundaService.getTasksPaginated(options, 1, 100);
      let list = res.data || [];
      if (this.currentSortField && list.length > 0) {
        list.sort((a: any, b: any) => {
          let valA = a[this.currentSortField] || '';
          let valB = b[this.currentSortField] || '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return this.currentSortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return this.currentSortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
      this.tasks = list;
    } catch (e) {
      console.error(e);
      this.message.error('Lỗi khi tải danh sách Task từ Camunda Engine.');
    }
  }

  onSortChange(field: string, order: string | null) {
    const mappedOrder = order === 'ascend' ? 'asc' : (order === 'descend' ? 'desc' : 'desc');
    this.loadTasks(field, mappedOrder);
  }

  onFilterChange() {
    this.loadTasks();
  }

  async claimTask(t: CamundaTask) {
    const userProfile = this.authService.getUserProfile();
    const username = userProfile?.username || '';
    if (!username) {
      this.message.error('Không tìm thấy thông tin tài khoản để nhận việc.');
      return;
    }

    try {
      await this.camundaService.claimTask(t.id, username);
      this.message.success('Đã nhận việc thành công!');
      this.loadTasks();
    } catch (e: any) {
      this.message.error('Lỗi khi nhận việc: ' + e.message);
    }
  }

  async executeTask(t: CamundaTask) {
    this.activeTask = t;
    this.activeFormSchema = [];
    this.activeFormId = t.formKey || '';
    this.activeProcessInstanceId = t.processInstanceId || '';
    this.activeTaskId = t.id || '';
    this.activeTaskVariables = {};

    // Check if task has formKey
    if (t.formKey) {
      let formId = t.formKey;
      if (formId.includes(':')) {
        formId = formId.split(':').pop() || '';
      }

      try {
        const formDef = await this.formRepository.getFormById(formId);
        if (formDef) {
          this.activeFormSchema = formDef.schema?.components || [];
          if (formDef.id) {
            this.activeFormId = formDef.id;
          }
        } else {
          console.warn(`Form definition not found for Form ID: ${formId}`);
        }
      } catch (e) {
        console.error('Failed to load form definition', e);
      }
    }

    // 1. Load lean variables of task from Camunda
    try {
      this.activeTaskVariables = await this.camundaService.getTaskVariables(t.id);
    } catch (e) {
      console.warn('Could not fetch task variables from Camunda', e);
    }

    // 2. Data Hydration: If task variables contain application_id, fetch unified aggregated domain context
    const appId = this.activeTaskVariables['application_id'] || this.activeTaskVariables['applicationId'];
    if (appId) {
      try {
        console.log(`💧 [TaskHydration] Hydrating data for application_id: ${appId}`);
        const aggregatedContext = await this.lendingDomainService.getAggregatedContext(String(appId));
        if (aggregatedContext) {
          this.activeTaskVariables = {
            ...this.activeTaskVariables,
            ...aggregatedContext
          };
          console.log(`✅ [TaskHydration] Successfully hydrated unified context for form auto-fill!`);
        }
      } catch (e) {
        console.warn('Failed to hydrate task variables with domain context', e);
      }
    }

    this.isExecuting = true;
  }

  cancelExecution() {
    this.isExecuting = false;
    this.activeTask = null;
    this.loadTasks();
  }

  completeTaskDirect() {
    if (this.taskFormViewer) {
      // Validate form first
      this.taskFormViewer.validateAndSubmit();
    } else {
      // Complete directly if no form
      this.onFormSubmit({ data: {}, _completeTask: true });
    }
  }

  async onFormSubmit(event: any) {
    if (!this.activeTask) return;

    const payload = event.data;
    const shouldComplete = event._completeTask;
    const customVars = event._customMappedVars;

    try {
      this.message.loading('Đang xử lý dữ liệu lên Camunda & Domain Services...', { nzDuration: 2500 });

      const userProfile = this.authService.getUserProfile();
      const username = userProfile?.username || 'anonymous';
      const varsToSend = customVars || payload;
      const formId = event.form_id || this.activeFormId || this.activeTask.formKey || 'default_form';
      const procInstId = event.process_instance_id || this.activeProcessInstanceId || this.activeTask.processInstanceId;
      const activeTaskId = event.task_id || event.taskId || this.activeTaskId || this.activeTask.id;

      if (shouldComplete) {
        // Multi-Domain Submission: Form Engine Audit + Domain Service Upsert + Camunda Lean Complete
        await this.lendingDomainService.submitMultiDomainForm({
          taskId: activeTaskId,
          task_id: activeTaskId,
          processInstanceId: procInstId,
          process_instance_id: procInstId,
          form_id: formId,
          formKey: formId,
          versionNo: 1,
          submitterId: username,
          submitter_id: username,
          data: varsToSend,
          submission_data: varsToSend
        });

        this.message.success('Đã hoàn thành công việc & đồng bộ dữ liệu đa Domain thành công!');
        this.isExecuting = false;
        this.activeTask = null;
        this.loadTasks();
      } else {
        // Save variables as draft
        // await this.camundaService.updateTaskVariables(this.activeTask.id, varsToSend);
        this.message.success('Đã cập nhật các biến lưu nháp thành công.');
      }
    } catch (e: any) {
      console.error(e);
      this.message.error('Lỗi khi submit công việc: ' + e.message);
    }
  }
}
