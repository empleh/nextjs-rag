export type ResponseBase<T> = {
  messages: string[];
  success: boolean;
  data: T;
};

export type RequestBase = {};

export class apiClient {
  static async post<TRequest extends RequestBase, TResponse extends ResponseBase<TResponse>>(url: string, request: TRequest): Promise<TResponse> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      return {
        data,
        success: true,
      } as TResponse;
    } catch (error) {
      return {
        success: false,
        messages: [error instanceof Error ? error.message : 'Error calling api'],
      } as TResponse;
    }
  }

  static async get<TResponse>(url: string): Promise<TResponse> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      return data as TResponse;
    } catch (error) {
      return {
        success: false,
        messages: [error instanceof Error ? error.message : 'Error calling api'],
      } as TResponse;
    }
  }
}
