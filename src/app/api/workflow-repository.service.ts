import { Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/constants';

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  xml: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowRepositoryService {
  private localKey = 'workflow_js_custom_db';
  private initialWorkflows: WorkflowRecord[] = [
    {
      id: 'sample_process',
      name: 'Sample Process',
      description: 'A sample workflow process',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_0e4i0cw" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="4.4.0">
  <bpmn:process id="Process_1" isExecutable="true" camunda:historyTimeToLive="45">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="99" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
    }
  ];

  constructor() {}

  getWorkflows(sortField?: string, sortOrder: string = 'desc'): WorkflowRecord[] {
    try {
      const data = localStorage.getItem(this.localKey);
      let list: WorkflowRecord[] = data ? JSON.parse(data) : this.initialWorkflows;
      if (sortField) {
        list.sort((a: any, b: any) => {
          let valA = a[sortField] || '';
          let valB = b[sortField] || '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
      return list;
    } catch (e) {
      console.error('Error reading workflow repository from localStorage:', e);
      return this.initialWorkflows;
    }
  }

  getWorkflowById(id: string): WorkflowRecord | null {
    const list = this.getWorkflows();
    return list.find(w => w.id === id) || null;
  }

  getWorkflowsPaginated(
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE,
    search: string = '',
    sortField: string = 'updatedAt',
    sortOrder: string = 'desc'
  ): { data: WorkflowRecord[]; total: number } {
    let workflows = this.getWorkflows();

    if (search) {
      const lower = search.toLowerCase();
      workflows = workflows.filter(w => 
        (w.name && w.name.toLowerCase().includes(lower)) || 
        (w.id && w.id.toLowerCase().includes(lower))
      );
    }

    if (sortField) {
      workflows.sort((a: any, b: any) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const startIndex = (page - 1) * size;
    return {
      data: workflows.slice(startIndex, startIndex + size),
      total: workflows.length
    };
  }

  saveWorkflow(workflow: Partial<WorkflowRecord> & { name: string }): WorkflowRecord {
    if (!workflow.name) {
      throw new Error('Tên workflow không được để trống.');
    }

    const list = this.getWorkflows();
    const existingIdx = list.findIndex(w => w.id === workflow.id || w.name.toLowerCase() === workflow.name.toLowerCase());
    
    const now = new Date().toISOString();
    const id = workflow.id || `workflow_${Date.now()}`;
    const savedWorkflow: WorkflowRecord = {
      id,
      name: workflow.name,
      description: workflow.description || '',
      createdAt: existingIdx !== -1 ? list[existingIdx].createdAt : now,
      updatedAt: now,
      xml: workflow.xml || ''
    };

    if (existingIdx !== -1) {
      list[existingIdx] = savedWorkflow;
    } else {
      list.push(savedWorkflow);
    }

    localStorage.setItem(this.localKey, JSON.stringify(list));
    return savedWorkflow;
  }

  deleteWorkflow(id: string): boolean {
    const list = this.getWorkflows();
    const filtered = list.filter(w => w.id !== id);
    localStorage.setItem(this.localKey, JSON.stringify(filtered));
    return true;
  }
}
