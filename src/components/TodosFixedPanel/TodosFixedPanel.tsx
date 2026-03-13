"use client";

import React from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Loader, CircleCheck, PauseCircle, Circle } from "lucide-react";
import "./TodosFixedPanel.css";

export interface TodoItem {
  content: string;
  status: string;
}

export interface TodosFixedPanelProps {
  todos: TodoItem[];
  expanded: boolean;
  onToggleExpand: () => void;
  isStreaming: boolean;
}

export function TodosFixedPanel({
  todos,
  expanded,
  onToggleExpand,
  isStreaming,
}: TodosFixedPanelProps) {
  if (!todos.length) return null;

  const completedCount = todos.filter((t) => t.status === "completed").length;
  // 全部执行完后，不再展示todopanel
  const allCompleted = completedCount === todos.length;
  if (allCompleted) return null;
  const inProgressTodo = todos.find((t) => t.status === "in_progress");
  const showDefaultTitle = expanded || !inProgressTodo;

  return (
    <div
      className={clsx(
        "todos-fixed-container translate-y-1 sm:translate-y-2 md:translate-y-3 lg:translate-y-5",
        !expanded && "collapsed"
      )}
    >
      <div
        className="todos-header"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        {showDefaultTitle ? (
          <div className="todos-title">
            <span className="todos-text">任务列表</span>
            <div className="todos-status">
              <span className="todos-count-completed">{completedCount}</span>
              <span className="todos-separator">/</span>
              <span className="todos-count-total">{todos.length}</span>
            </div>
          </div>
        ) : (
          <div className="todos-title todos-title-progress">
            <div className="todos-progress-content">
              {isStreaming ? (
                <Loader className="todos-icon-progress rotating" />
              ) : (
                <PauseCircle className="todos-icon-progress" />
              )}
              <span className="todos-progress-text">
                正在{inProgressTodo?.content ?? "..."}
              </span>
            </div>
            <div className="todos-status">
              <span className="todos-count-completed">{completedCount}</span>
              <span className="todos-separator">/</span>
              <span className="todos-count-total">{todos.length}</span>
            </div>
          </div>
        )}
        <div className="todos-divider" />
        {expanded ? (
          <ChevronDown className="toggle-icon expanded" />
        ) : (
          <ChevronRight className="toggle-icon" />
        )}
      </div>
      <div className={clsx("todos-content", expanded ? "expanded" : "collapsed")}>
          {todos.map((todo, index) => (
            <div
              key={index}
              className={clsx("todo-item", `todo-${todo.status}`)}
            >
              {todo.status === "completed" ? (
                <CircleCheck className="todo-status-icon" />
              ) : todo.status === "in_progress" ? (
                isStreaming ? (
                  <Loader className="todo-status-icon rotating" />
                ) : (
                  <PauseCircle className="todo-status-icon" />
                )
              ) : (
                <Circle className="circle-icon-todo" />
              )}
              <span className="todo-content">{todo.content}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
