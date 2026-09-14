import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

export interface ProcessDefinition {
  id: string;
  key: string;
  name: string;
  category: string;
  version: number;
  resource: string;
  deploymentId: string;
  diagram: string | null;
  suspended: boolean;
  tenantId: string | null;
  versionTag: string | null;
  historyTimeToLive: number | null;
  startableInTasklist: boolean;
}

export interface CamundaTask {
  id: string;
  name: string;
  assignee: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  delegationState: string | null;
  description: string | null;
  executionId: string;
  owner: string | null;
  parentTaskId: string | null;
  priority: number;
  processDefinitionId: string;
  processInstanceId: string;
  taskDefinitionKey: string;
  caseExecutionId: string | null;
  caseInstanceId: string | null;
  caseDefinitionId: string | null;
  suspended: boolean;
  formKey: string | null;
  tenantId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CamundaService {
  private baseUrl = APP_CONFIG.CAMUNDA_REST_URL;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json'
    });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  async getProcessDefinitions(): Promise<ProcessDefinition[]> {
    try {
      const obs = this.http.get<ProcessDefinition[]>(`${this.baseUrl}/process-definition?latestVersion=true`, {
        headers: this.getHeaders()
      });
      return await firstValueFrom(obs);
    } catch (e) {
      console.error('Failed to fetch process definitions from Camunda', e);
      return [];
    }
  }

  async getProcessDefinitionsPaginated(
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE,
    search: string = '',
    sortField: string = 'version',
    sortOrder: string = 'desc'
  ): Promise<{ data: ProcessDefinition[]; total: number }> {
    const firstResult = (page - 1) * size;
    let query = `?sortBy=${sortField}&sortOrder=${sortOrder}`;
    let countQuery = '?1=1';

    if (search) {
      const searchEscaped = encodeURIComponent(search);
      query += `&nameLike=%${searchEscaped}%`;
      countQuery += `&nameLike=%${searchEscaped}%`;
    }

    try {
      const dataObs = this.http.get<ProcessDefinition[]>(`${this.baseUrl}/process-definition${query}&firstResult=${firstResult}&maxResults=${size}`, {
        headers: this.getHeaders()
      });
      const countObs = this.http.get<{ count: number }>(`${this.baseUrl}/process-definition/count${countQuery}`, {
        headers: this.getHeaders()
      });

      const [data, countData] = await Promise.all([
        firstValueFrom(dataObs),
        firstValueFrom(countObs)
      ]);

      return { data, total: countData.count };
    } catch (e) {
      console.error('Failed to fetch paginated process definitions', e);
      return { data: [], total: 0 };
    }
  }

  async getProcessDefinitionXml(processDefinitionId: string): Promise<{ id: string; bpmn20Xml: string }> {
    const obs = this.http.get<{ id: string; bpmn20Xml: string }>(`${this.baseUrl}/process-definition/${processDefinitionId}/xml`, {
      headers: this.getHeaders()
    });
    return await firstValueFrom(obs);
  }

  async deployWorkflow(name: string, xml: string): Promise<any> {
    return this.deployResource(name, xml, '.bpmn');
  }

  async deployResource(name: string, content: string, extension: string = '.bpmn'): Promise<any> {
    const formData = new FormData();
    formData.append('deployment-name', name);
    formData.append('deployment-source', 'angular-dashboard');
    formData.append('enable-duplicate-filtering', 'true');
    formData.append('deploy-changed-only', 'true');
    
    const blob = new Blob([content], { type: 'text/xml' });
    formData.append('data', blob, `${name}${extension}`);

    // Fetch with authorization headers (HttpClient handles FormData naturally, but we omit Content-Type header to let browser set boundary)
    const headers = this.getHeaders();
    const obs = this.http.post<any>(`${this.baseUrl}/deployment/create`, formData, {
      headers: headers
    });
    return await firstValueFrom(obs);
  }

  async startProcessInstance(processDefinitionId: string): Promise<any> {
    const obs = this.http.post<any>(`${this.baseUrl}/process-definition/${processDefinitionId}/start`, {}, {
      headers: this.getHeaders().set('Content-Type', 'application/json')
    });
    return await firstValueFrom(obs);
  }

  async startProcessInstanceByKey(processDefinitionKey: string): Promise<any> {
    const obs = this.http.post<any>(`${this.baseUrl}/process-definition/key/${processDefinitionKey}/start`, {}, {
      headers: this.getHeaders().set('Content-Type', 'application/json')
    });
    return await firstValueFrom(obs);
  }

  async getTasks(options: { processInstanceId?: string; assignee?: string } = {}): Promise<CamundaTask[]> {
    let url = `${this.baseUrl}/task?active=true`;
    if (options.processInstanceId) {
      url += `&processInstanceId=${options.processInstanceId}`;
    }
    if (options.assignee) {
      url += `&assignee=${options.assignee}`;
    }
    const obs = this.http.get<CamundaTask[]>(url, { headers: this.getHeaders() });
    return await firstValueFrom(obs);
  }

  async getTasksPaginated(
    options: {
      processInstanceId?: string;
      assignee?: string;
      unassigned?: boolean;
      candidateGroup?: string;
      candidateUser?: string;
      nameLike?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE
  ): Promise<{ data: CamundaTask[]; total: number }> {
    const firstResult = (page - 1) * size;
    let query = `?active=true`;
    if (options.processInstanceId) query += `&processInstanceId=${options.processInstanceId}`;
    if (options.assignee) query += `&assignee=${options.assignee}`;
    if (options.unassigned) query += `&unassigned=true`;
    if (options.candidateGroup) query += `&candidateGroup=${options.candidateGroup}`;
    if (options.candidateUser) query += `&candidateUser=${options.candidateUser}`;
    
    if (options.nameLike) query += `&nameLike=%${encodeURIComponent(options.nameLike)}%`;
    if (options.sortBy) {
      query += `&sortBy=${options.sortBy}&sortOrder=${options.sortOrder || 'desc'}`;
    } else {
      query += `&sortBy=created&sortOrder=desc`;
    }

    try {
      const dataObs = this.http.get<CamundaTask[]>(`${this.baseUrl}/task${query}&firstResult=${firstResult}&maxResults=${size}`, {
        headers: this.getHeaders()
      });
      const countObs = this.http.get<{ count: number }>(`${this.baseUrl}/task/count${query}`, {
        headers: this.getHeaders()
      });

      const [data, countData] = await Promise.all([
        firstValueFrom(dataObs),
        firstValueFrom(countObs)
      ]);

      return { data, total: countData.count };
    } catch (e) {
      console.error('Failed to fetch paginated tasks', e);
      return { data: [], total: 0 };
    }
  }

  async getTaskDetails(taskId: string): Promise<CamundaTask> {
    const obs = this.http.get<CamundaTask>(`${this.baseUrl}/task/${taskId}`, { headers: this.getHeaders() });
    return await firstValueFrom(obs);
  }

  async getTaskVariables(taskId: string): Promise<{ [key: string]: any }> {
    try {
      const obs = this.http.get<{ [key: string]: { value: any; type: string } }>(`${this.baseUrl}/task/${taskId}/variables`, {
        headers: this.getHeaders()
      });
      const data = await firstValueFrom(obs);
      const variables: { [key: string]: any } = {};
      for (const key in data) {
        variables[key] = data[key].value;
      }
      return variables;
    } catch (e) {
      console.error('Failed to load variables for task ' + taskId, e);
      return {};
    }
  }

  async updateTaskVariables(taskId: string, variables: { [key: string]: any } = {}): Promise<boolean> {
    const modifications: { [key: string]: { value: any } } = {};
    for (const key in variables) {
      modifications[key] = { value: variables[key] };
    }
    const obs = this.http.post<void>(`${this.baseUrl}/task/${taskId}/variables`, { modifications }, {
      headers: this.getHeaders().set('Content-Type', 'application/json')
    });
    await firstValueFrom(obs);
    return true;
  }

  async completeTask(taskId: string, variables: { [key: string]: any } = {}): Promise<boolean> {
    const formattedVariables: { [key: string]: { value: any } } = {};
    const mergedVars: { [key: string]: any } = {
      approved: true,
      ...variables
    };

    for (const key in mergedVars) {
      if (mergedVars[key] !== undefined && mergedVars[key] !== null) {
        formattedVariables[key] = { value: mergedVars[key] };
      }
    }
    const obs = this.http.post<void>(`${this.baseUrl}/task/${taskId}/complete`, { variables: formattedVariables }, {
      headers: this.getHeaders().set('Content-Type', 'application/json')
    });
    await firstValueFrom(obs);
    return true;
  }

  async claimTask(taskId: string, userId: string): Promise<boolean> {
    const obs = this.http.post<void>(`${this.baseUrl}/task/${taskId}/claim`, { userId }, {
      headers: this.getHeaders().set('Content-Type', 'application/json')
    });
    await firstValueFrom(obs);
    return true;
  }

  async deleteProcessInstance(processInstanceId: string): Promise<boolean> {
    const obs = this.http.delete<void>(`${this.baseUrl}/process-instance/${processInstanceId}`, {
      headers: this.getHeaders()
    });
    await firstValueFrom(obs);
    return true;
  }

  async deleteDeployment(deploymentId: string): Promise<boolean> {
    const obs = this.http.delete<void>(`${this.baseUrl}/deployment/${deploymentId}?cascade=true`, {
      headers: this.getHeaders()
    });
    await firstValueFrom(obs);
    return true;
  }
}
